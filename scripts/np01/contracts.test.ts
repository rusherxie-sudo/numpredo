import {test} from 'node:test';
import assert from 'node:assert/strict';
import {returnPath} from '../../src/client/learning-transfer.ts';
import {pdfMeta,previewMeta} from '../../src/client/pdf-measurement.ts';
import {track} from '../../src/client/track.ts';
import {npTrack} from '../../src/client/np01-track.ts';
import {readTrip,writeTrip,LEARNING_KEY} from '../../src/client/learning-state.ts';
import {readdirSync} from 'node:fs';
import {join} from 'node:path';
test('return paths reject external, traversal, unsupported query/date/tab/number',()=>{
 for(const bad of ['https://example.com/','//example.com/','/play/\\evil','/play/%2e%2e/daily/','/play/%252e%252e/daily/','/play/?n=0','/play/?n=1&n=2','/play/?n=NaN','/play/?n=10001','/daily/?tab=7','/daily/?tab=-1','/daily/archive/?d=2026-02-30','/daily/?d=2026-01-01','/play/?title=synthetic','/play/?return=/','/play/foo/','/play/#arbitrary'])assert.equal(returnPath(bad),null,'reject invalid return');
 for(const good of ['/','/?n=2#sudoku-game','/play/?n=1#sudoku-game','/play/intermediate/?n=37#sudoku-game','/daily/?tab=5#sudoku-game','/daily/archive/?d=2026-11-01&tab=1#sudoku-game','/guide/newspaper/#newspaper-input'])assert.equal(returnPath(good),good);
});
test('all existing public PDFs and real preview images have finite mapping',()=>{
 const walk=(d:string):string[]=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
 const pdfs=walk('public/downloads').filter(x=>x.endsWith('.pdf'));
 for(const f of pdfs)assert(pdfMeta('/'+f.slice(7)), 'known public PDF mapped');
 for(const f of walk('public/images').filter(x=>/\/(print\/[^/]+-preview|collections\/[^/]+-(questions|answers))\.png$/.test(x)))assert(previewMeta('/'+f.slice(7)),'known preview mapped');
 assert.equal(pdfMeta('/downloads/arbitrary.pdf'),null);assert.equal(pdfMeta('/downloads/collections/unknown-questions.pdf'),null);
});
test('new-event whitelist strips arbitrary parameters and queues real Arguments; historical params retained',()=>{
 const w={dataLayer:[] as unknown[]};Object.assign(globalThis,{window:w});
 npTrack('puzzle_first_input',{game_mode:'library',game_level:'beginner',daily_slot:999,title:'synthetic',grid:'synthetic',href:'synthetic',user_id:'synthetic',technique:'free'});
 const a=w.dataLayer[0] as IArguments;
 assert.equal(Object.prototype.toString.call(a),'[object Arguments]');assert.deepEqual(a[2],{measurement_version:'np01',game_mode:'library',game_level:'beginner'});
 track('game_start',{level:'初級',daily:false});assert.deepEqual((w.dataLayer[1] as IArguments)[2],{level:'初級',daily:false});
 Object.assign(w,{dataLayer:{push(){throw Error('synthetic');}}});assert.doesNotThrow(()=>track('game_hint',{title:'synthetic'}));
});
test('single pending version TTL and storage failure do not throw',()=>{
 const m=new Map<string,string>();Object.assign(globalThis,{sessionStorage:{getItem:(k:string)=>m.get(k),setItem:(k:string,v:string)=>m.set(k,v),removeItem:(k:string)=>m.delete(k)}});
 for(const t of [{v:99},{v:1,at:Date.now()-7200001},{v:1,at:Date.now()+999999}]){m.set(LEARNING_KEY,JSON.stringify(t));assert.equal(readTrip(),null);}
 m.set(LEARNING_KEY,'{');assert.equal(readTrip(),null);
 Object.assign(globalThis,{sessionStorage:{getItem(){throw Error('synthetic');},setItem(){throw Error('synthetic');}}});assert.equal(readTrip(),null);assert.equal(writeTrip({} as never),false);
});

import {restore as restoreMeasurement} from '../../src/client/np01-game.ts';
test('new and legacy measurement status preserves unknown; h is authoritative',()=>{
 assert.equal(restoreMeasurement().input,'no');assert.equal(restoreMeasurement({} as never).input,'unknown');
 assert.equal(restoreMeasurement({} as never).hint,'unknown');assert.equal(restoreMeasurement({h:0} as never).hint,'no');assert.equal(restoreMeasurement({h:1} as never).hint,'yes');
 assert.equal(restoreMeasurement({h:0,measurement:{v:1,input:'yes',hint:'yes',revision:2,generation:1}} as never).hint,'no');
 assert.equal(restoreMeasurement({measurement:{v:99}} as never).input,'unknown');
});
