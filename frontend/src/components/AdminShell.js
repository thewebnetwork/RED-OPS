import React from 'react';
import Layout from './Layout';

/**
 * AdminShell
 * Thin wrapper for the Operator/Admin experience.
 * Currently leverages the shared Layout but prepared for decoupling.
 */
const AdminShell = ({ children }) => {
  return (
    <Layout shellType="admin">
      {children}
    </Layout>
  );
};

export default AdminShell;
