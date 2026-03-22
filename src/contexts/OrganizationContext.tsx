'use client';

import React, { createContext, useContext } from 'react';

export type Organization = {
  id: string;
  company_name: string;
  slug: string | null;
  currency?: string | null;
};

const OrganizationContext = createContext<Organization | null>(null);

export function OrganizationProvider({
  organization,
  children,
}: {
  organization: Organization;
  children: React.ReactNode;
}) {
  return (
    <OrganizationContext.Provider value={organization}>{children}</OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) {
    throw new Error('useOrganization must be used within [slug] routes');
  }
  return ctx;
}

/** Safe variant when outside slug layout (should not happen in app shell). */
export function useOrganizationOptional() {
  return useContext(OrganizationContext);
}
