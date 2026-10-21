export type SoundName='whoosh'|'pop'|'turn'|'flip'|'reveal'|'victory';
const sources:Record<SoundName,string>={whoosh:'whoosh.wav',pop:'pop.wav',turn:'turn.wav',flip:'flip.wav',reveal:'reveal.wav',victory:'victory.wav'};
/** Plays licensed recordings through one gain node, including volume control on iOS. */
export class SoundManager {
  private enabled=true;
  private volume=.35;
  private context:AudioContext|null=null;
  private gain:GainNode|null=null;
  private loads=new Map<SoundName,Promise<AudioBuffer|null>>();
  private active=new Set<AudioBufferSourceNode>();
  private recent=new Set<string>();
  private last=0;
  private generation=0;
  configure(enabled:boolean,volume:number){
    this.enabled=enabled;this.volume=Number.isFinite(volume)?Math.max(0,Math.min(1,volume)):.35;
    if(this.gain)this.gain.gain.value=this.volume;
    if(!enabled||!this.volume)this.stop();
  }
  unlock(){
    try{
      if(!this.context){
        const Constructor=globalThis.AudioContext||(globalThis as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
        if(!Constructor)return;
        this.context=new Constructor();this.gain=this.context.createGain();this.gain.gain.value=this.volume;this.gain.connect(this.context.destination);
      }
      if(this.context.state==='suspended')void this.context.resume().catch(()=>{});
      for(const name of Object.keys(sources) as SoundName[])void this.load(name);
    }catch{/* Audio is optional; unsupported/blocked playback never interrupts a move. */}
  }
  private load(name:SoundName):Promise<AudioBuffer|null>{
    const existing=this.loads.get(name);if(existing)return existing;
    const context=this.context;if(!context)return Promise.resolve(null);
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),8000);
    const pending=fetch(new URL(`assets/audio/${sources[name]}`,document.baseURI).href,{signal:controller.signal})
      .then(response=>{if(!response.ok)throw Error('Audio unavailable');return response.arrayBuffer();})
      .then(data=>context.decodeAudioData(data)).catch(()=>null).finally(()=>clearTimeout(timeout));
    this.loads.set(name,pending);return pending;
  }
  play(name:SoundName,key:string){
    const now=performance.now();
    if(!this.enabled||!this.volume||!this.context||document.hidden||this.recent.has(key))return;
    if(name!=='victory'&&now-this.last<90)return;
    this.recent.add(key);if(this.recent.size>256)this.recent.delete(this.recent.values().next().value!);
    this.last=now;if(name==='victory')this.stop();
    const generation=this.generation;
    void this.load(name).then(buffer=>{
      // Discard late loading and old screens; never queue a surprising sound for later.
      if(!buffer||!this.enabled||!this.volume||generation!==this.generation||document.hidden||performance.now()-now>250||this.active.size>=2||this.context?.state!=='running'||!this.gain)return;
      let source:AudioBufferSourceNode|undefined;
      try{
        source=this.context.createBufferSource();source.buffer=buffer;source.connect(this.gain);this.active.add(source);
        const current=source;source.onended=()=>{this.active.delete(current);current.disconnect();};source.start();
      }catch{if(source){this.active.delete(source);try{source.disconnect();}catch{/* Device unavailable. */}}}
    }).catch(()=>{});
  }
  stop(){
    this.generation++;
    for(const source of this.active){try{source.onended=null;source.stop();source.disconnect();}catch{/* Already stopped. */}}
    this.active.clear();
  }
}
