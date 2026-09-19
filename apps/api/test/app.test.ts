import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import type { Repository } from "../src/repository.js";
import { config } from "../src/config.js";

const fakeRepository: Repository = {
  courses:async()=>[{courseCode:'CS 1530',courseTitle:null,professorCount:2,reviewCount:23,rawCommentText:'PRIVATE_MARKER'}],
  departments: async () => [{ id: "computer-science", name: "Computer Science", offeringCount: 2 }],
  offerings: async () => [
    { id: "1", score: 82, reviewCount: 20, avgDifficulty: 1.8, tags: ["online_exams", "notecard_allowed"] },
    { id: "2", score: null, reviewCount: 3, avgDifficulty: 2.5, tags: ["online_exams"] },
  ],
  offering: async (id) => id === "1" ? { id: "1", rmpLegacyId: 123 } : null,
  offeringTags: async () => [{ tagType: "online_exams", mentionCount: 4, confidence: 0.9 }],
};

describe("API", () => {
  it('accepts configured web origins with trailing slashes without allowing other origins', async () => {
    const previous = config.WEB_ORIGIN;
    try {
      config.WEB_ORIGIN = ' http://localhost:3000/ , https://easy.example/ ';
      const generator = vi.fn().mockResolvedValue({ status: 'pending' });
      const app = createApp(fakeRepository, undefined, generator);
      for (const origin of ['http://localhost:3000', 'https://easy.example']) {
        const response = await request(app).get('/courses/CS1530/offerings').set('Origin', origin);
        expect(response.status).toBe(200);
        expect(response.headers['access-control-allow-origin']).toBe(origin);
        const overview = await request(app).post('/offerings/1/overview/generate').set('Origin', origin).send({});
        expect(overview.status).toBe(200);
      }
      const blocked = await request(app).get('/courses/CS1530/offerings').set('Origin', 'https://untrusted.example');
      expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
      const blockedOverview = await request(app).post('/offerings/1/overview/generate').set('Origin', 'https://untrusted.example').send({});
      expect(blockedOverview.status).toBe(403);
      expect(generator).toHaveBeenCalledTimes(2);
    } finally { config.WEB_ORIGIN = previous; }
  });
  it('lists course summaries without private fields',async()=>{
    const response=await request(createApp(fakeRepository)).get('/schools/1247/courses');
    expect(response.body.data[0].courseCode).toBe('CS 1530');
    expect(JSON.stringify(response.body)).not.toContain('PRIVATE_MARKER');
  });
  it.each(['CS1530','CS 1530','cs1530'])('compares by normalized course rather than department: %s',async code=>{
    const offerings=vi.fn().mockResolvedValue([{id:'low',score:null,reviewCount:3,tags:[]},{id:'high',score:80,reviewCount:9,tags:[],rawCommentText:'PRIVATE_MARKER'}]);
    const response=await request(createApp({...fakeRepository,offerings})).get(`/courses/${encodeURIComponent(code)}/offerings`);
    expect(offerings).toHaveBeenCalledWith(null,'CS 1530');
    expect(response.body.data.map((r:any)=>r.id)).toEqual(['high','low']);
    expect(JSON.stringify(response.body)).not.toContain('PRIVATE_MARKER');
  });
  it('rejects ambiguous course numbers and filters new tags with AND semantics',async()=>{
    const app=createApp({...fakeRepository,offerings:async()=>[{id:'a',tags:['online_quizzes','extra_credit_offered']},{id:'b',tags:['online_quizzes']}]});
    expect((await request(app).get('/courses/1530/offerings')).status).toBe(400);
    expect((await request(app).get('/courses/CS1530/offerings?tags=online_quizzes,extra_credit_offered')).body.data.map((r:any)=>r.id)).toEqual(['a']);
  });
  it('never returns review text or private payloads from any public offering endpoint',async()=>{
    const privateFields={raw_comment_text:'PRIVATE_MARKER',rawCommentText:'PRIVATE_MARKER',reviews:[{comment:'PRIVATE_MARKER'}],payload:{comment:'PRIVATE_MARKER'},matchedText:'PRIVATE_MARKER'};
    const app=createApp({...fakeRepository,
      offerings:async()=>[{id:'1',tags:[],...privateFields}],
      offering:async()=>({id:'1',...privateFields}),
      offeringTags:async()=>[{tagType:'online_exams',...privateFields}],
    });
    for(const path of ['/departments/computer-science/offerings','/offerings/1','/offerings/1/tags']) {
      const r=await request(app).get(path);
      expect(r.status).toBe(200);
      expect(JSON.stringify(r.body)).not.toContain('PRIVATE_MARKER');
    }
  });
  const app = createApp(fakeRepository);
  it("lists departments", async () => {
    const response = await request(app).get("/schools/1247/departments");
    expect(response.status).toBe(200);
    expect(response.body.data[0].id).toBe("computer-science");
  });
  it("applies AND semantics to tag filters", async () => {
    const response = await request(app).get("/departments/computer-science/offerings?tags=online_exams,notecard_allowed");
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe("1");
  });
  it("returns an attributed RMP detail link without review text", async () => {
    const response = await request(app).get("/offerings/1");
    expect(response.body.data.rmpUrl).toBe("https://www.ratemyprofessors.com/professor/123");
    expect(JSON.stringify(response.body)).not.toContain("rawComment");
  });
});
