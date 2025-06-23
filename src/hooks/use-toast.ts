import * as React from "react"

// Simplified toast implementation for now
let toastId = 0;

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

function showToast({ title, description, variant = 'default' }: ToastOptions) {
  const id = ++toastId;
  const container = document.getElementById('toast-container');
  
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `
    mb-2 p-4 rounded-lg shadow-lg max-w-sm
    ${variant === 'destructive' ? 'bg-red-500 text-white' : 'bg-white border border-gray-200'}
    animate-in slide-in-from-right duration-300
  `;
  
  toast.innerHTML = `
    <div class="flex justify-between items-start">
      <div>
        ${title ? `<div class="font-medium">${title}</div>` : ''}
        ${description ? `<div class="text-sm ${variant === 'destructive' ? 'text-red-100' : 'text-gray-600'}">${description}</div>` : ''}
      </div>
      <button onclick="this.parentElement.parentElement.remove()" class="ml-2 text-gray-400 hover:text-gray-600">×</button>
    </div>
  `;

  container.appendChild(toast);

  // Auto remove after 5 seconds
  setTimeout(() => {
    if (toast.parentElement) {
      toast.remove();
    }
  }, 5000);

  return {
    id,
    dismiss: () => toast.remove()
  };
}

export function useToast() {
  return {
    toast: showToast,
    dismiss: (id?: string) => {
      // Simple implementation - remove all toasts if no id provided
      const container = document.getElementById('toast-container');
      if (container) {
        container.innerHTML = '';
      }
    },
    toasts: [] // Empty for now
  };
}

export { showToast as toast };