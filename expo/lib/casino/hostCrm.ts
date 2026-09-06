import type { BookedCruise } from '@/types/models';

export type HostCrmActivityType = 'conversation' | 'promise' | 'comp_request' | 'outcome' | 'follow_up' | 'note';
export type HostPromiseKind='freeplay'|'obc'|'upgrade'|'dining'|'transportation'|'discretionary_comp'|'other';
export interface HostCrmActivity { id:string; type:HostCrmActivityType; occurredAt:string; notes:string; requestedValue?:number; promisedKind?:HostPromiseKind; promisedValue?:number; deliveredValue?:number; evidenceUri?:string; cruiseId?:string; status?:'open'|'partial'|'fulfilled'|'declined'; outcome?:string; followUpAt?:string; completed?:boolean }
export interface CasinoHostRecord { id:string; name:string; program:string; ships:string[]; email?:string; phone?:string; notes?:string; activities:HostCrmActivity[]; createdAt:string; updatedAt:string }
const normalize=(value:string)=>value.trim().toLowerCase();
export function seedCasinoHostsFromCruises(cruises:BookedCruise[], existing:CasinoHostRecord[], now=new Date().toISOString()):CasinoHostRecord[]{
  const result=[...existing];
  cruises.forEach(cruise=>{const name=cruise.casinoHost?.trim();if(!name)return;const match=result.find(host=>normalize(host.name)===normalize(name));if(match){const ships=new Set([...match.ships,cruise.shipName].filter(Boolean));match.ships=[...ships];match.email=match.email||cruise.casinoHostEmail;match.phone=match.phone||cruise.casinoHostPhone;return;}result.push({id:`host-${normalize(name).replace(/[^a-z0-9]+/g,'-')}-${result.length}`,name,program:String(cruise.casinoProgram??cruise.brand??cruise.cruiseSource??'unknown'),ships:[cruise.shipName].filter(Boolean),email:cruise.casinoHostEmail,phone:cruise.casinoHostPhone,activities:[],createdAt:now,updatedAt:now});});
  return result;
}
export function addHostActivity(hosts:CasinoHostRecord[],hostId:string,activity:Omit<HostCrmActivity,'id'>,now=new Date().toISOString()):CasinoHostRecord[]{
  return hosts.map(host=>host.id!==hostId?host:{...host,updatedAt:now,activities:[{...activity,id:`activity-${Date.now()}-${host.activities.length}`},...host.activities].slice(0,500)});
}
export function pendingHostFollowUps(hosts:CasinoHostRecord[],now=new Date()):Array<{host:CasinoHostRecord;activity:HostCrmActivity;overdue:boolean}>{
  return hosts.flatMap(host=>host.activities.filter(a=>a.followUpAt&&!a.completed).map(activity=>({host,activity,overdue:new Date(`${activity.followUpAt}T23:59:59`).getTime()<now.getTime()}))).sort((a,b)=>(a.activity.followUpAt??'').localeCompare(b.activity.followUpAt??''));
}
export function hostRelationshipHealth(host:CasinoHostRecord,now=new Date()){const latest=host.activities.map(a=>Date.parse(a.occurredAt)).filter(Number.isFinite).sort((a,b)=>b-a)[0],days=latest?Math.floor((now.getTime()-latest)/86400000):999,open=host.activities.filter(a=>(a.type==='promise'||a.type==='follow_up')&&!a.completed&&(a.status??'open')!=='fulfilled'),fulfilled=host.activities.filter(a=>a.type==='promise'&&((a.status==='fulfilled')||a.completed)).length,score=Math.max(0,Math.min(100,50+(days<=30?15:days>120?-15:0)+Math.min(20,fulfilled*5)-Math.min(25,open.length*5)));return{score,factors:[`Last activity ${days===999?'not recorded':`${days} day(s) ago`}`,`${open.length} open promise/follow-up(s)`,`${fulfilled} fulfilled promise(s)`],factsOnly:true}}
export function hostPromiseLedger(host:CasinoHostRecord){return host.activities.filter(a=>a.type==='promise').map(activity=>({...activity,deliveredCounted:activity.status==='fulfilled'&&typeof activity.deliveredValue==='number'?activity.deliveredValue:0,remainingValue:Math.max(0,(activity.promisedValue??0)-(activity.deliveredValue??0)),overdue:Boolean(activity.followUpAt&&!activity.completed&&Date.parse(`${activity.followUpAt}T23:59:59`)<Date.now())}))}
