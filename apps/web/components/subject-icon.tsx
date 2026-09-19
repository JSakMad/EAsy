import {
  Plus,ChartNoAxesCombined,CodeXml,Database,Network,Cpu,Atom,FlaskConical,Dna,Brain,BrainCircuit,
  Telescope,Leaf,Mountain,Globe,Map,BookOpen,PenLine,Languages,Hand,Scroll,Landmark,Scale,
  Palette,Film,Music,Drama,Newspaper,MessagesSquare,Megaphone,BriefcaseBusiness,Calculator,
  TrendingUp,Coins,Users,Truck,Target,Lightbulb,Building2,Ruler,Cog,Zap,Fuel,Plane,Shield,
  GraduationCap,School,Stethoscope,HeartPulse,Pill,Activity,Accessibility,Apple,Microscope,
  ScanLine,Wind,HeartHandshake,Compass,Library,type LucideIcon,
} from 'lucide-react';
import {PITT_SUBJECTS} from '@easy-a/core';

// Related subjects share a meaningful visual family, rather than arbitrary
// unique glyphs. Every approved subject is explicitly covered; new courses
// inherit their subject's icon automatically without needing imported reviews.
export const SUBJECT_ICON_GROUPS:readonly {codes:string;icon:LucideIcon}[]=[
  {codes:'MATH',icon:Plus},
  {codes:'STAT BUSQOM',icon:ChartNoAxesCombined},
  {codes:'CS CMPINF CIST',icon:CodeXml},
  {codes:'INFSCI HI',icon:Database},
  {codes:'BUSBIS IS MIS',icon:Network},
  {codes:'COE',icon:Cpu},
  {codes:'PHYS',icon:Atom},
  {codes:'CHEM CHE',icon:FlaskConical},
  {codes:'BIOL BIOSC BIOENG',icon:Dna},
  {codes:'NROSCI',icon:Brain},
  {codes:'PSY EDPSY PSYED COUN',icon:BrainCircuit},
  {codes:'ASTRON',icon:Telescope},
  {codes:'ENVSTD ES BUSENV NATSC',icon:Leaf},
  {codes:'GEO GEOL',icon:Mountain},
  {codes:'GEOG',icon:Map},
  {codes:'INTS EAS AFRCNA',icon:Globe},
  {codes:'ENG ENGCMP ENGLIT ENGLSH CLP HUMAN',icon:BookOpen},
  {codes:'ENGWRT WRITNG',icon:PenLine},
  {codes:'ARABIC BCMS CHIN ELI FR GER GREEK GREEKM HEBREW HINDI HUN IRISH ITAL JPNSE KOREAN LATIN LCTL LING PERS POLISH PORT QUECH RUSS SERCRO SLAV SLI SLOVAK SPAN SWAHIL SWE TURKSH UKRAIN VIET',icon:Languages},
  {codes:'ASL ACITP',icon:Hand},
  {codes:'HIST CLASS MRST',icon:Scroll},
  {codes:'PS PIA PUBSRV EXLK',icon:Landmark},
  {codes:'ADMJ CJ CRIM LCJS LEGLST BIOETH',icon:Scale},
  {codes:'ART FA IA SA EXLA',icon:Palette},
  {codes:'ENGFLM FILMST FMST',icon:Film},
  {codes:'MUSIC',icon:Music},
  {codes:'THEA',icon:Drama},
  {codes:'JOURNL',icon:Newspaper},
  {codes:'COMM COMMRC CSD',icon:MessagesSquare},
  {codes:'BUSMKT MRKT PR',icon:Megaphone},
  {codes:'BUS BUSERV MGMT',icon:BriefcaseBusiness},
  {codes:'ACCT BUSACC CDACCT',icon:Calculator},
  {codes:'ECON BUSECN',icon:TrendingUp},
  {codes:'BUSFIN FIN',icon:Coins},
  {codes:'BUSHRM BUSORG SOC SOCSCI ANTH GSWS WOMNST',icon:Users},
  {codes:'BUSSCM',icon:Truck},
  {codes:'BUSSPP LDRSHP',icon:Target},
  {codes:'ENTR PHIL HPS',icon:Lightbulb},
  {codes:'URBNST HMGT',icon:Building2},
  {codes:'ARC HAA CE CEE',icon:Ruler},
  {codes:'ENGR ENGSCI ET IE ME MEMS MET EXLH',icon:Cog},
  {codes:'ECE EE EET EGET EST',icon:Zap},
  {codes:'GRO PET PETE',icon:Fuel},
  {codes:'AFROTC',icon:Plane},
  {codes:'MILS NPHS',icon:Shield},
  {codes:'ECED EDUC EFOP ELED FDSED IL IT MLED SCED SPLED TLL EXLG LNSK',icon:GraduationCap},
  {codes:'PITT SETHL WCC',icon:School},
  {codes:'DENT DENHYG OCS HLTHCR HRP HRS EXLI',icon:Stethoscope},
  {codes:'NUR EM HCM HHD PUBHLT EXLP EXLR',icon:HeartPulse},
  {codes:'PHARM DSPHL EXLQ',icon:Pill},
  {codes:'ATHLTR EXSCI HPEDU HPRED PEDC',icon:Activity},
  {codes:'PHYSTA REHSCI PO RT',icon:Accessibility},
  {codes:'NUTR',icon:Apple},
  {codes:'CLRES FORSCI SURTEC EXLJ',icon:Microscope},
  {codes:'RADSC',icon:ScanLine},
  {codes:'RESCA',icon:Wind},
  {codes:'SOCWRK EXLL',icon:HeartHandshake},
  {codes:'FP FS HONORS INDIST',icon:Compass},
  {codes:'ARTSC CAS CGS DUCATH JS RELGST',icon:Library},
];
export const SUBJECT_ICONS:Readonly<Record<string,LucideIcon>>=Object.fromEntries(
  SUBJECT_ICON_GROUPS.flatMap(({codes,icon})=>codes.split(' ').map(code=>[code,icon])),
);
export function SubjectIcon({courseCode,size=19}:{courseCode:string;size?:number}) {
  const subject=courseCode.normalize('NFKC').toUpperCase().trim().match(/^[A-Z]+/)?.[0]??'';
  const Icon=SUBJECT_ICONS[subject]??GraduationCap;
  return <Icon size={size} aria-hidden="true" data-subject={subject}><title>{PITT_SUBJECTS[subject]??'Course'}</title></Icon>;
}
