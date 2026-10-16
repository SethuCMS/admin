/**
 * Build-time switch for the editor-only view.
 *
 * Built with VITE_CONTENT_ONLY=true, the app shows nothing but Content: no
 * Connections, no Roles and access, no Move data. That build is the one served
 * at /sethu on a customer's own website. The full admin panel (the hosted
 * build without this switch) is for admins. The gateway enforces roles either
 * way; this only decides what the page shows.
 */
export const contentOnly = import.meta.env.VITE_CONTENT_ONLY === 'true';
