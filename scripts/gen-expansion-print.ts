import {mkdirSync,writeFileSync} from 'node:fs';
import {buildPrintSets} from '../src/data/expansion/print-sets.ts';
const packs=buildPrintSets();mkdirSync('public/downloads/collections',{recursive:true});
writeFileSync('public/downloads/collections/manifest.json',JSON.stringify({version:1,packs},null,2)+'\n');
console.log(`${packs.length} print sets; ${packs.reduce((n,p)=>n+p.items.length,0)} selected puzzles`);
