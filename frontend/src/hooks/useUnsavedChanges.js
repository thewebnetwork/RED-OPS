import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

/**
 * Custom hook to detect unsaved changes and warn user before leaving
 * @param {boolean} hasUnsavedChanges - Whether the form has unsaved changes
 * @param {Function} onSave - Optional save function to call when user chooses "Save & Leave"
 * @returns {Object} - { UnsavedChangesDialog, setHasChanges, confirmNavigation }
 */
export function useUnsavedChanges(initialHasChanges = false) {
  const [hasChanges, setHasChanges] = useState(initialHasChanges);
  const [showDialog, setShowDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isNavigatingRef = useRef(false);

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

  // Reset when location changes (successful navigation)
  useEffect(() => {
    if (isNavigatingRef.current) {
      isNavigatingRef.current = false;
      setHasChanges(false);
    }
  }, [location]);

  const handleNavigate = useCallback((path) => {
    if (hasChanges && !isNavigatingRef.current) {
      setPendingNavigation(path);
      setShowDialog(true);
      return false;
    }
    return true;
  }, [hasChanges]);

  const confirmNavigation = useCallback(() => {
    isNavigatingRef.current = true;
    setShowDialog(false);
    setHasChanges(false);
    if (pendingNavigation) {
      navigate(pendingNavigation);
    }
    setPendingNavigation(null);
  }, [navigate, pendingNavigation]);

  const cancelNavigation = useCallback(() => {
    setShowDialog(false);
    setPendingNavigation(null);
  }, []);

  const resetChanges = useCallback(() => {
    setHasChanges(false);
  }, []);

  const markAsChanged = useCallback(() => {
    setHasChanges(true);
  }, []);

  // Dialog component to render
  const UnsavedChangesDialog = () => (
    <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes. Save before leaving?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={cancelNavigation}>
            Stay
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmNavigation}
            className="bg-slate-600 hover:bg-slate-700"
          >
            Leave without saving
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return {
    hasChanges,
    setHasChanges,
    markAsChanged,
    resetChanges,
    handleNavigate,
    UnsavedChangesDialog,
    showDialog,
    setShowDialog,
    confirmNavigation,
    cancelNavigation,
  };
}

/**
 * Wrapper component for navigation links that checks for unsaved changes
 */
export function SafeLink({ to, children, hasChanges, onNavigate, ...props }) {
  const navigate = useNavigate();

  const handleClick = (e) => {
    e.preventDefault();
    if (hasChanges) {
      onNavigate(to);
    } else {
      navigate(to);
    }
  };

  return (
    <a href={to} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}
