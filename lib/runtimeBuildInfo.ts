export interface RuntimeBuildInfo {
  layoutVersion: string;
  buildTimestamp: string;
}

export function getRuntimeBuildInfo(layoutVersion: string): RuntimeBuildInfo {
  return {
    layoutVersion,
    buildTimestamp: new Date().toISOString(),
  };
}
