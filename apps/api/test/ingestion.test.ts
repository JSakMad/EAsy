import {describe,it,expect,vi} from 'vitest';
import {RmpHttpClient,BudgetReached,retryAfterDate} from '../src/ingestion/http-client.js';
import {mapReview,nextCursor} from '../src/ingestion/rmp-schema.js';

const rating={id:'review-1',class:'NROSCI0080',date:'2026-09-01 00:05:00 +0000 UTC',grade:'A-',difficultyRating:2,
  helpfulRating:4,clarityRating:5,attendanceMandatory:'non mandatory',comment:'Private fixture comment.'};
describe('RMP mapping',()=>{
  it('preserves the original course field and parses actual source date format',()=>{
    expect(mapReview(rating)).toMatchObject({rawCourse:'NROSCI0080',datePosted:'2026-09-01T00:05:00.000Z',gradeReceived:'A-',attendanceMandatory:false});
  });
  it.each(['N/A','Not sure yet','Not Available',''])('excludes missing grade %s',grade=>expect(mapReview({...rating,grade}).gradeReceived).toBeNull());
  it('does not fabricate a rating or review identity',()=>{
    expect(()=>mapReview({...rating,difficultyRating:null})).toThrow();
    expect(()=>mapReview({...rating,id:undefined})).toThrow();
  });
  it('stops on repeated or missing pagination cursors',()=>{
    expect(()=>nextCursor({hasNextPage:true,endCursor:'x'},new Set(['x']))).toThrow();
    expect(()=>nextCursor({hasNextPage:true,endCursor:null},new Set())).toThrow();
  });
});
describe('request safeguards',()=>{
  it.each([401,403,302])('stops after one HTTP %s response and persists the access block',async status=>{
    const gate={reserve:vi.fn(),pause:vi.fn()};
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response('',{status}));
    await expect(new RmpHttpClient(gate,5,fetcher).request('query',{})).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(gate.pause.mock.calls[0]?.[1]).toMatch(/blocked/);
  });
  it('honors long Retry-After values and never retries 429',async()=>{
    const gate={reserve:vi.fn(),pause:vi.fn()};
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response('',{status:429,headers:{'Retry-After':'172800'}}));
    await expect(new RmpHttpClient(gate,5,fetcher).request('query',{})).rejects.toThrow('429');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((gate.pause.mock.calls[0]?.[0] as Date).getTime()).toBeGreaterThan(Date.now()+47*3600000);
    expect(retryAfterDate('invalid',0).getTime()).toBe(86400000);
    expect(retryAfterDate('Thu, 03 Jan 2030 00:00:00 GMT',0).getUTCFullYear()).toBe(2030);
  });
  it('never requests past the run budget or a persisted block',async()=>{
    const gate={reserve:vi.fn(),pause:vi.fn()};
    const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>Response.json({data:{ok:true}}));
    const client=new RmpHttpClient(gate,1,fetcher);
    await client.request('query',{});
    await expect(client.request('query',{})).rejects.toBeInstanceOf(BudgetReached);
    expect(fetcher).toHaveBeenCalledTimes(1);
    gate.reserve.mockRejectedValue(new Error('blocked'));
    await expect(new RmpHttpClient(gate,1,fetcher).request('query',{})).rejects.toThrow('blocked');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({redirect:'manual',headers:{'User-Agent':'EAsy/1.0 (personal Pitt course research; sequential requests)'}});
  });
  it('blocks HTML challenges even when HTTP status is 200',async()=>{
    const gate={reserve:vi.fn(),pause:vi.fn()};
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>Challenge</html>',{headers:{'content-type':'text/html'}}));
    await expect(new RmpHttpClient(gate,1,fetcher).request('query',{})).rejects.toThrow('challenge');
    expect(gate.pause).toHaveBeenCalled();
  });
});
