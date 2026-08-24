import type { BookedCruise } from '@/types/models';

export type HostCrmActivityType = 'conversation' | 'promise' | 'comp_request' | 'outcome' | 'follow_up' | 'note';
export interface HostCrmActivity { id:string; type:HostCrmActivityType; occurredAt:string; notes:string; requestedValue?:number; outcome?:string; followUpAt?:string; completed?:boolean }
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
