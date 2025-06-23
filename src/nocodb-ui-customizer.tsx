import { useEffect } from 'react';

interface NocoDBUICustomizerProps {
  isAdminMode: boolean;
}

export default function NocoDBUICustomizer({ isAdminMode }: NocoDBUICustomizerProps) {
  useEffect(() => {
    if (!isAdminMode) return;

    // CSS to hide specific elements for admin users in NocoDB
    const adminModeCSS = `
      <style id="admin-mode-customization">
        /* Hide Import CSV button in Tables section */
        [data-testid="nc-import-csv"],
        .nc-import-csv,
        button[title*="Import"],
        button:has-text("Import CSV"),
        .ant-menu-item:has-text("Import"),
        .nc-sidebar-table-import,
        .nc-import-table-btn {
          display: none !important;
        }

        /* Hide view type buttons (Gallery, Calendar, Kanban, Chart) - keep only Grid */
        .nc-view-type-selector .nc-gallery-view,
        .nc-view-type-selector .nc-calendar-view,
        .nc-view-type-selector .nc-kanban-view,
        .nc-view-type-selector .nc-chart-view,
        button[data-testid="nc-gallery-view"],
        button[data-testid="nc-calendar-view"],
        button[data-testid="nc-kanban-view"],
        button[data-testid="nc-chart-view"],
        .ant-tabs-tab:has-text("Gallery"),
        .ant-tabs-tab:has-text("Calendar"),
        .ant-tabs-tab:has-text("Kanban"),
        .ant-tabs-tab:has-text("Chart") {
          display: none !important;
        }

        /* Hide Add Column button */
        button[data-testid="nc-add-column"],
        .nc-add-column-btn,
        button:has-text("Add Column"),
        .nc-grid-add-new-column,
        .nc-new-column-header {
          display: none !important;
        }

        /* Hide Manage Columns button if it's for adding/removing columns */
        button[title*="Manage Columns"]:has-text("Add"),
        .nc-manage-columns-btn {
          display: none !important;
        }

        /* Hide any other import/export related buttons */
        button:has-text("Import"),
        button:has-text("Export"),
        .nc-import-btn,
        .nc-export-btn {
          display: none !important;
        }

        /* Additional hiding for any Import CSV related elements */
        .nc-sidebar-table-import-btn,
        .nc-table-import,
        [aria-label*="Import"],
        .nc-import-table-modal-trigger {
          display: none !important;
        }
      </style>
    `;

    // Inject the CSS into the document head
    const styleElement = document.createElement('div');
    styleElement.innerHTML = adminModeCSS;
    document.head.appendChild(styleElement.firstElementChild!);

    // Also use MutationObserver to handle dynamically loaded elements
    const observer = new MutationObserver(() => {
      // Hide Import CSV buttons
      const importButtons = document.querySelectorAll([
        '[data-testid="nc-import-csv"]',
        '.nc-import-csv',
        'button[title*="Import"]',
        '.nc-sidebar-table-import',
        '.nc-import-table-btn'
      ].join(', '));
      
      importButtons.forEach(btn => {
        (btn as HTMLElement).style.display = 'none';
      });

      // Hide view type buttons except Grid
      const viewButtons = document.querySelectorAll([
        '[data-testid="nc-gallery-view"]',
        '[data-testid="nc-calendar-view"]', 
        '[data-testid="nc-kanban-view"]',
        '[data-testid="nc-chart-view"]'
      ].join(', '));
      
      viewButtons.forEach(btn => {
        (btn as HTMLElement).style.display = 'none';
      });

      // Hide Add Column button
      const addColumnButtons = document.querySelectorAll([
        '[data-testid="nc-add-column"]',
        '.nc-add-column-btn',
        '.nc-grid-add-new-column'
      ].join(', '));
      
      addColumnButtons.forEach(btn => {
        (btn as HTMLElement).style.display = 'none';
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Cleanup function
    return () => {
      observer.disconnect();
      const style = document.getElementById('admin-mode-customization');
      if (style) {
        style.remove();
      }
    };
  }, [isAdminMode]);

  return null; // This component doesn't render anything
}