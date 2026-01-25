import { useState, useEffect, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Button } from './ui/button';

/**
 * UnsavedChangesGuard - Wrap any form content to add unsaved changes protection
 * 
 * Usage:
 * <UnsavedChangesGuard hasChanges={formHasChanges} onReset={() => setFormHasChanges(false)}>
 *   <form>...</form>
 * </UnsavedChangesGuard>
 */
export default function UnsavedChangesGuard({ 
  children, 
  hasChanges = false, 
  onReset,
  dialogOpen,
  onDialogOpenChange 
}) {
  const [showDialog, setShowDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  // Handle browser refresh/close
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  // Handle browser back button
  useEffect(() => {
    const handlePopState = (e) => {
      if (hasChanges) {
        // Push state back to prevent navigation
        window.history.pushState(null, '', window.location.href);
        setShowDialog(true);
        setPendingAction('back');
      }
    };

    // Push initial state
    if (hasChanges) {
      window.history.pushState(null, '', window.location.href);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [hasChanges]);

  const handleLeave = useCallback(() => {
    setShowDialog(false);
    if (onReset) onReset();
    if (pendingAction === 'back') {
      window.history.back();
    }
    setPendingAction(null);
  }, [onReset, pendingAction]);

  const handleStay = useCallback(() => {
    setShowDialog(false);
    setPendingAction(null);
  }, []);

  return (
    <>
      {children}
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent data-testid="unsaved-changes-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Save before leaving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleStay} data-testid="stay-btn">
              Stay
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeave}
              className="bg-slate-600 hover:bg-slate-700"
              data-testid="leave-btn"
            >
              Leave without saving
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Hook for tracking form changes
 * @param {Object} initialData - Initial form data to compare against
 * @returns {Object} - { hasChanges, trackChanges, resetTracking }
 */
export function useFormChanges(initialData = {}) {
  const [originalData, setOriginalData] = useState(JSON.stringify(initialData));
  const [currentData, setCurrentData] = useState(JSON.stringify(initialData));

  const hasChanges = originalData !== currentData;

  const trackChanges = useCallback((newData) => {
    setCurrentData(JSON.stringify(newData));
  }, []);

  const resetTracking = useCallback((newInitialData = null) => {
    const data = JSON.stringify(newInitialData || JSON.parse(originalData));
    setOriginalData(data);
    setCurrentData(data);
  }, [originalData]);

  const setInitialData = useCallback((data) => {
    const jsonData = JSON.stringify(data);
    setOriginalData(jsonData);
    setCurrentData(jsonData);
  }, []);

  return { hasChanges, trackChanges, resetTracking, setInitialData };
}

/**
 * Dialog-aware version for use with Dialog components
 * Shows warning when trying to close dialog with unsaved changes
 */
export function useDialogUnsavedChanges() {
  const [hasChanges, setHasChanges] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);

  const handleDialogOpenChange = useCallback((open) => {
    if (!open && hasChanges) {
      // User trying to close dialog with unsaved changes
      setShowWarning(true);
      setPendingClose(true);
      return false; // Prevent closing
    }
    return true; // Allow closing
  }, [hasChanges]);

  const confirmClose = useCallback(() => {
    setShowWarning(false);
    setHasChanges(false);
    setPendingClose(false);
    return true; // Now allow closing
  }, []);

  const cancelClose = useCallback(() => {
    setShowWarning(false);
    setPendingClose(false);
  }, []);

  const markChanged = useCallback(() => {
    setHasChanges(true);
  }, []);

  const resetChanges = useCallback(() => {
    setHasChanges(false);
  }, []);

  const WarningDialog = () => (
    <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
      <AlertDialogContent data-testid="unsaved-changes-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes. Save before leaving?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={cancelClose} data-testid="stay-btn">
            Stay
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmClose}
            className="bg-slate-600 hover:bg-slate-700"
            data-testid="leave-btn"
          >
            Leave without saving
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return {
    hasChanges,
    markChanged,
    resetChanges,
    handleDialogOpenChange,
    pendingClose,
    WarningDialog,
    showWarning,
    confirmClose,
    cancelClose
  };
}
