export interface AbstractRole {
  id: number;
  role: string;
}

export type RoleCfg = AbstractRole

export type RolePack = {} & RoleCfg;
