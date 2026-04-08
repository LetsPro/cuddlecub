import { useSyncExternalStore } from 'react';

let activeRequests = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function beginNetworkRequest() {
  activeRequests += 1;
  emit();
}

export function endNetworkRequest() {
  activeRequests = Math.max(0, activeRequests - 1);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return activeRequests > 0;
}

export function useNetworkLoading() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
