import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { TAG_TYPES, normalizeCourseCode } from "@easy-a/core";
import { config } from "./config.js";
import { repository as defaultRepository, type Repository } from "./repository.js";
import { runImport } from './jobs/ingest.js';
import { publicOffering, publicTag } from './public-data.js';
import {getCloudOverview,ensureCloudOverview} from './overview/cloud-service.js';

export function createApp(repository: Repository = defaultRepository,overviewReader:(id:string)=>Promise<unknown>=getCloudOverview,overviewGenerator=ensureCloudOverview) {
  const app = express();
  const webOrigins = config.WEB_ORIGIN.split(",").map(origin => origin.trim().replace(/\/+$/, ""));
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: webOrigins }));
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_req, res) => res.json({ ok: true, service: "easy-a-api" }));
  app.get('/schools/:id/courses', async (req,res,next) => {
    try {
      const rows=await repository.courses(req.params.id!);
      res.json({data:rows.map(r=>({courseCode:r.courseCode,courseTitle:r.courseTitle,professorNames:r.professorNames??[],professorCount:r.professorCount,reviewCount:r.reviewCount}))});
    } catch(error) {next(error);}
  });
  app.get('/courses/:code/offerings', async (req,res,next) => {
    try {
      let code=normalizeCourseCode(req.params.code!,{});
      if(code.startsWith('UNMAPPED ')) {
        const catalogCode=req.params.code!.trim().toUpperCase().match(/^([A-Z][A-Z &]*?)\s*(\d{3,5}[A-Z]*)$/);
        if(catalogCode) code=`${catalogCode[1]!.trim()} ${catalogCode[2]}`;
      }
      if(code.startsWith('UNMAPPED ')) return res.status(400).json({error:'Use a subject and course number, such as CS 1530.'});
      let rows=await repository.offerings(null,code);
      const tags=String(req.query.tags ?? '').split(',').filter(t=>TAG_TYPES.includes(t as never));
      rows=rows.filter(r=>tags.every(t=>r.tags?.includes(t)));
      rows.sort((a,b)=>(b.score===null?-1:Number(b.score))-(a.score===null?-1:Number(a.score)) || Number(b.reviewCount)-Number(a.reviewCount));
      res.json({data:rows.map(publicOffering),meta:{courseCode:code,count:rows.length}});
    } catch(error) {next(error);}
  });
  app.get("/schools/:id/departments", async (req, res, next) => {
    try { res.json({ data: await repository.departments(req.params.id!) }); } catch (error) { next(error); }
  });
  app.get("/departments/:id/offerings", async (req, res, next) => {
    try {
      let rows = await repository.offerings(req.params.id!);
      const tags = String(req.query.tags ?? "").split(",").filter((tag) => TAG_TYPES.includes(tag as never));
      if (tags.length) rows = rows.filter((row) => tags.every((tag) => row.tags?.includes(tag)));
      const sort = String(req.query.sort ?? "easy_a_score");
      if (sort === "reviews") rows.sort((a, b) => Number(b.reviewCount ?? 0) - Number(a.reviewCount ?? 0));
      if (sort === "difficulty") rows.sort((a, b) => Number(a.avgDifficulty ?? 99) - Number(b.avgDifficulty ?? 99));
      res.json({ data: rows.map(publicOffering), meta: { count: rows.length, activeTags: tags } });
    } catch (error) { next(error); }
  });
  app.get("/offerings/:id", async (req, res, next) => {
    try {
      const row = await repository.offering(req.params.id!);
      if (!row) return res.status(404).json({ error: "Offering not found" });
      res.json({ data: publicOffering(row) });
    } catch (error) { next(error); }
  });
  app.get('/offerings/:id/overview',async(req,res,next)=>{
    try {
      const data=await overviewReader(req.params.id!);
      if(!data)return res.status(404).json({error:'Offering not found'});
      res.set('Cache-Control','no-store');
      res.json({data});
    } catch(error){next(error);}
  });
  app.post('/offerings/:id/overview/generate',async(req,res)=>{
    res.set('Cache-Control','no-store');
    const origin=req.header('origin');
    if(origin&&!webOrigins.includes(origin))return res.status(403).json({error:'Origin not allowed'});
    if(!req.is('application/json')||Object.keys(req.body??{}).length)return res.status(400).json({error:'Send an empty JSON object; evidence is selected by the server.'});
    try {
      const data=await overviewGenerator(req.params.id!);
      if(!data)return res.status(404).json({error:'Offering not found'});
      return res.json({data});
    } catch {return res.status(503).json({error:'Overview temporarily unavailable'});}
  });
  app.get("/offerings/:id/tags", async (req, res, next) => {
    try { res.json({ data: (await repository.offeringTags(req.params.id!)).map(row=>publicTag(row as Record<string,unknown>)) }); } catch (error) { next(error); }
  });
  app.post("/admin/ingest/professors/:rmpProfessorId", async (req, res, next) => {
    try {
      if (!config.ADMIN_API_KEY || req.header("authorization") !== `Bearer ${config.ADMIN_API_KEY}`) return res.status(401).json({ error: "Unauthorized" });
      const result = await runImport({professor:req.params.rmpProfessorId!,limit:1});
      if (result.status==='paused'||result.status==='failed') return res.status(503).json({error:result.message});
      res.json({ data: result });
    } catch (error) { next(error); }
  });

  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);
    res.status(500).json({ error: "The request could not be completed." });
  });
  return app;
}
