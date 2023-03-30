interface NewKeycloakUser {
  firstName: string;
  lastName: string;
  email: string;
  enabled: boolean;
  credentials: KeycloakCredentials[];
}

export interface KeycloakCredentials {
  type: string;
  value: string;
  temporary: boolean;
}

export interface KeycloakUser {
  id: string
  createdTimestamp: number
  username: string
  enabled: boolean
  totp: boolean
  emailVerified: boolean
  firstName: string
  lastName: string
  email: string
  disableableCredentialTypes: any[]
  requiredActions: any[]
  notBefore: number
  access: KeycloakAccess
}

interface KeycloakAccess {
  manageGroupMembership: boolean
  view: boolean
  mapRoles: boolean
  impersonate: boolean
  manage: boolean
}


export {NewKeycloakUser};
