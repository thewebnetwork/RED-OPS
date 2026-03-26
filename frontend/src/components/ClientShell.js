import React from 'react';
import Layout from './Layout';

/**
 * ClientShell
 * Thin wrapper for the Client Portal experience.
 * Currently leverages the shared Layout but prepared for decoupling.
 */
const ClientShell = ({ children }) => {
  return (
    <Layout shellType="client">
      {children}
    </Layout>
  );
};

export default ClientShell;
