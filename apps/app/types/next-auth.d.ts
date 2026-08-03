import type { Membership } from "@repo/db/queries";
import type { UserTenantRole } from "@repo/shared";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      tenantId: string | null;
      role: UserTenantRole | null;
      tenantName: string | null;
      tenantSlug: string | null;
      hasPassword: boolean;
      memberships: Membership[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    tenantId?: string | null;
    role?: UserTenantRole | null;
    tenantName?: string | null;
    tenantSlug?: string | null;
    hasPassword?: boolean;
    memberships?: Membership[];
  }
}
