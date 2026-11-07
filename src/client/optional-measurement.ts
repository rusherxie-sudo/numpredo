// Start optional loading without awaiting it in any original UI setup.
let measurement: typeof import('./np01-track.ts') | undefined;
void import('./np01-track.ts').then(m=>{measurement=m;}).catch(()=>{});
export function printIntent(kind:Parameters<typeof import('./np01-track.ts')['printIntent']>[0]):void {
  measurement?.npTrack('print_intent',{print_kind:kind});
  try{window.print();}catch{/* intent is not printing success */}
}
export function initPdfMeasurement():void {
  void import('./pdf-measurement.ts').then(m=>m.initPdfMeasurement()).catch(()=>{});
}
