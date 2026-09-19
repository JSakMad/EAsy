import React from 'react';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {render,screen,cleanup,act} from '@testing-library/react';
import {renderToString} from 'react-dom/server';
import {AiOverview} from '../components/ai-overview';
import type {Overview} from '../lib/types';
const pending:Overview={status:'pending',totalReviews:100,stats:{reviewCount:100,datedCount:100,undatedCount:0,futureDatedCount:0,oldestReviewAt:'2020-01-01',newestReviewAt:'2025-01-01',reviewsInLast24Months:10,asOf:'2026-09-16'}};
const ready:Overview={...pending,status:'ready',stats:{...pending.stats,reviewCount:8},generatedAt:'2026-09-16',overview:{summary:'Synthetic saved overview.',easierFactors:[],harderFactors:[],studyAdvice:[],changesOverTime:'No clear trend.'}};
describe('on-demand overview card',()=>{
  beforeEach(()=>{vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn());});
  afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
  it('does not trigger requests during server rendering/prefetch',()=>{
    expect(renderToString(<AiOverview data={pending} demo={false} offeringId="test"/>)).toContain('AI course overview');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('automatically generates on mount and renders the sampled count',async()=>{
    vi.mocked(fetch).mockResolvedValue(Response.json({data:ready}));
    render(<AiOverview data={pending} demo={false} offeringId="test"/>,{reactStrictMode:true});
    await act(async()=>{await vi.advanceTimersByTimeAsync(101);});
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/offerings/test/overview/generate'),expect.objectContaining({method:'POST',body:'{}'}));
    expect(screen.getByText('Synthetic saved overview.')).toBeTruthy();
    expect(screen.getByText('8 sampled of 100 stored reviews')).toBeTruthy();
  });
  it.each(['ready','insufficient'] as const)('does not request generation for %s evidence',async status=>{
    render(<AiOverview data={{...ready,status}} demo={false} offeringId="test"/>);
    await act(async()=>{await vi.advanceTimersByTimeAsync(200);});
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not generate for demo pages or after unmount',async()=>{
    const demo=render(<AiOverview data={null} demo offeringId="demo-1"/>);
    await act(async()=>{await vi.advanceTimersByTimeAsync(200);});demo.unmount();
    const page=render(<AiOverview data={pending} demo={false} offeringId="test"/>);page.unmount();
    await act(async()=>{await vi.advanceTimersByTimeAsync(200);});
    expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps expired saved content visibly dated if refresh fails',async()=>{
    vi.mocked(fetch).mockRejectedValue(new Error('Unavailable'));
    render(<AiOverview data={{...ready,status:'stale'}} demo={false} offeringId="test"/>);
    await act(async()=>{await vi.advanceTimersByTimeAsync(101);});
    expect(screen.getByText('Synthetic saved overview.')).toBeTruthy();
    expect(screen.getByText(/saved summary is over 30 days old/)).toBeTruthy();
  });
  it('bounds automatic cooldown polling to three requests',async()=>{
    vi.mocked(fetch).mockImplementation(async()=>Response.json({data:{...pending,reason:'cooldown',retryAfter:3}}));
    render(<AiOverview data={pending} demo={false} offeringId="test"/>);
    await act(async()=>{await vi.advanceTimersByTimeAsync(10000);});
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('does not retry quota or authentication errors automatically',async()=>{
    vi.mocked(fetch).mockImplementation(async()=>Response.json({data:{...pending,reason:'quota',retryAfter:60}}));
    render(<AiOverview data={pending} demo={false} offeringId="test"/>);
    await act(async()=>{await vi.advanceTimersByTimeAsync(120000);});
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/free API allowance/)).toBeTruthy();
  });
});
