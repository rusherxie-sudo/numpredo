import {mkdirSync,writeFileSync} from 'node:fs';
import {PROGRESSION_PACK} from '../src/data/progression-pack.ts';
mkdirSync('public/downloads/progression',{recursive:true});
writeFileSync('public/downloads/progression/manifest.json',JSON.stringify({version:'01',packs:PROGRESSION_PACK},null,2)+'\n');
