export type SoundName='whoosh'|'pop'|'turn'|'flip'|'reveal'|'victory';
const defaultSources:Record<SoundName,string>={whoosh:'paper-whoosh.wav',pop:'paper-pop.wav',turn:'paper-turn.wav',flip:'paper-flip.wav',reveal:'paper-reveal.wav',victory:'paper-victory.wav'};
/** Plays licensed recordings through one gain node, including volume control on iOS. */
export class SoundManager<Name extends string=SoundName> {
  constructor(private sources:Record<Name,string>=defaultSources as unknown as Record<Name,string>,private musical=false){}
  private enabled=true;
  private volume=.35;
  private context:AudioContext|null=null;
  private gain:GainNode|null=null;
  private loads=new Map<Name,Promise<AudioBuffer|null>>();
  private active=new Set<AudioBufferSourceNode>();
  private recent=new Set<string>();
  private last=0;
  private generation=0;
  get needsGesture(){return this.context?.state==='suspended';}
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
      for(const name of Object.keys(this.sources) as Name[])void this.load(name);
    }catch{/* Audio is optional; unsupported/blocked playback never interrupts a move. */}
  }
  async prepare(){
    this.unlock();
    // Wait briefly for a permitted resume; blocked autoplay must never hold the UI.
    if(this.context?.state==='suspended'){let timeout:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([this.context.resume().catch(()=>{}),new Promise<void>(resolve=>{timeout=setTimeout(resolve,400);})]);}finally{clearTimeout(timeout);}}
    await Promise.all((Object.keys(this.sources) as Name[]).map(name=>this.load(name)));
  }
  private load(name:Name):Promise<AudioBuffer|null>{
    const existing=this.loads.get(name);if(existing)return existing;
    const context=this.context;if(!context)return Promise.resolve(null);
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),8000);
    const pending=fetch(new URL(`assets/audio/${this.sources[name]}`,document.baseURI).href,{signal:controller.signal})
      .then(response=>{if(!response.ok)throw Error('Audio unavailable');return response.arrayBuffer();})
      .then(data=>context.decodeAudioData(data)).catch(()=>null).finally(()=>clearTimeout(timeout));
    this.loads.set(name,pending);return pending;
  }
  play(name:Name,key:string,timeline?:{startedAt:number;durationMs:number}){
    const now=performance.now();
    if(!this.enabled||!this.volume||!this.context||this.context.state!=='running'||document.hidden||this.recent.has(key)||(timeline&&now-timeline.startedAt>=timeline.durationMs))return;
    if(name!=='victory'&&now-this.last<90)return;
    this.recent.add(key);if(this.recent.size>256)this.recent.delete(this.recent.values().next().value!);
    this.last=now;if(name==='victory'||this.musical)this.stop();
    const generation=this.generation;
    void this.load(name).then(buffer=>{
      // Discard late loading and old screens; never queue a surprising sound for later.
      if(!buffer||!this.enabled||!this.volume||generation!==this.generation||document.hidden||performance.now()-now>(this.musical?900:250)||this.active.size>=2||this.context?.state!=='running'||!this.gain)return;
      const offset=timeline?Math.max(0,(performance.now()-timeline.startedAt)/1000):0;
      if(buffer.duration!==undefined&&buffer.duration-offset<.1)return;
      let source:AudioBufferSourceNode|undefined;
      try{
        source=this.context.createBufferSource();source.buffer=buffer;
        if(this.musical){const envelope=this.context.createGain(),start=this.context.currentTime,end=start+buffer.duration-offset;envelope.gain.setValueAtTime(0,start);envelope.gain.linearRampToValueAtTime(1,start+.08);envelope.gain.setValueAtTime(1,Math.max(start+.08,end-.35));envelope.gain.linearRampToValueAtTime(0,end);source.connect(envelope);envelope.connect(this.gain);source.addEventListener('ended',()=>envelope.disconnect(),{once:true});}else source.connect(this.gain);
        this.active.add(source);
        const current=source;source.onended=()=>{this.active.delete(current);current.disconnect();};if(timeline)source.start(0,offset);else source.start();
      }catch{if(source){this.active.delete(source);try{source.disconnect();}catch{/* Device unavailable. */}}}
    }).catch(()=>{});
  }
  stop(){
    this.generation++;
    for(const source of this.active){try{source.onended=null;source.stop();source.disconnect();}catch{/* Already stopped. */}}
    this.active.clear();
  }
}
