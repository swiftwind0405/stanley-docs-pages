/* ─── HR Attendance Confirm · Form Logic ─── */
(function () {
  'use strict';

  const STORAGE_PREFIX = 'hr-confirm-';
  let formId = '';
  let saveTimer = null;

  /* ─── Init ─── */
  function init() {
    const formEl = document.querySelector('[data-form-id]');
    if (!formEl) return;
    formId = formEl.dataset.formId;

    restoreFromStorage();
    bindTriState();
    bindInputs();
    bindAddRows();
    updateProgress();

    document.querySelectorAll('.btn-export-json').forEach(b => b.addEventListener('click', exportJSON));
    document.querySelectorAll('.btn-clear').forEach(b => b.addEventListener('click', clearForm));
  }

  /* ─── Tri-state confirm radios ─── */
  function bindTriState() {
    document.querySelectorAll('.tri-state input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', function () {
        const row = this.closest('.confirm-row') || this.closest('.feedback-row');
        if (!row) return;
        const comment = row.querySelector('.confirm-comment');
        if (comment) {
          const val = this.value;
          comment.classList.toggle('hidden', val === 'correct');
        }
        scheduleSave();
        updateProgress();
      });
    });
  }

  /* ─── All inputs auto-save ─── */
  function bindInputs() {
    document.querySelectorAll('input, textarea, select').forEach(el => {
      const evt = (el.type === 'radio' || el.type === 'checkbox') ? 'change' : 'input';
      el.addEventListener(evt, () => { scheduleSave(); updateProgress(); });
    });
  }

  /* ─── Dynamic add-row ─── */
  function bindAddRows() {
    document.querySelectorAll('.add-row-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const tableId = this.dataset.table;
        const tbody = document.querySelector(`#${tableId} tbody`);
        if (!tbody) return;
        const lastRow = tbody.querySelector('tr:last-child');
        if (!lastRow) return;
        const clone = lastRow.cloneNode(true);
        clone.querySelectorAll('input').forEach(inp => {
          if (inp.type === 'checkbox') inp.checked = false;
          else inp.value = '';
        });
        tbody.appendChild(clone);
        bindInputs();
        scheduleSave();
      });
    });
  }

  /* ─── Progress ─── */
  function updateProgress() {
    const allRadios = document.querySelectorAll('.tri-state');
    if (allRadios.length === 0) return;

    let answered = 0;
    allRadios.forEach(group => {
      if (group.querySelector('input[type="radio"]:checked')) answered++;
    });

    const pct = Math.round((answered / allRadios.length) * 100);
    const fill = document.querySelector('.progress-fill');
    const text = document.querySelector('.progress-text');
    if (fill) fill.style.width = pct + '%';
    if (text) text.textContent = `${answered} / ${allRadios.length}  (${pct}%)`;
  }

  /* ─── Save / Restore ─── */
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveToStorage, 500);
  }

  function saveToStorage() {
    const data = collectFormData();
    try {
      localStorage.setItem(STORAGE_PREFIX + formId, JSON.stringify(data));
    } catch (e) { /* quota exceeded, ignore */ }
  }

  function restoreFromStorage() {
    let raw;
    try { raw = localStorage.getItem(STORAGE_PREFIX + formId); } catch (e) { return; }
    if (!raw) return;

    let data;
    try { data = JSON.parse(raw); } catch (e) { return; }
    if (!data || !data.sections) return;

    // Restore sections
    data.sections.forEach(sec => {
      sec.items.forEach(item => {
        if (item.status) {
          const radio = document.querySelector(`input[name="${item.id}"][value="${item.status}"]`);
          if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        if (item.comment) {
          const ta = document.querySelector(`textarea[name="${item.id}_comment"]`);
          if (ta) ta.value = item.comment;
        }
      });
    });

    // Restore free_text
    if (data.free_text) {
      Object.entries(data.free_text).forEach(([key, val]) => {
        const el = document.querySelector(`[name="${key}"]`);
        if (el) el.value = val;
      });
    }

    // Restore meta
    if (data.meta) {
      if (data.meta.confirmed_by) {
        const el = document.querySelector('[name="confirmed_by"]');
        if (el) el.value = data.meta.confirmed_by;
      }
      if (data.meta.confirmed_at) {
        const el = document.querySelector('[name="confirmed_at"]');
        if (el) el.value = data.meta.confirmed_at;
      }
    }

    // Restore tables
    if (data.tables) {
      Object.entries(data.tables).forEach(([tableId, rows]) => {
        const tbody = document.querySelector(`#${tableId} tbody`);
        if (!tbody) return;
        const existingRows = tbody.querySelectorAll('tr');
        rows.forEach((rowData, i) => {
          let tr = existingRows[i];
          if (!tr && i > 0) {
            const addBtn = document.querySelector(`.add-row-btn[data-table="${tableId}"]`);
            if (addBtn) addBtn.click();
            tr = tbody.querySelectorAll('tr')[i];
          }
          if (!tr) return;
          const inputs = tr.querySelectorAll('input');
          let inputIdx = 0;
          Object.values(rowData).forEach(val => {
            const inp = inputs[inputIdx++];
            if (!inp) return;
            if (inp.type === 'checkbox') inp.checked = !!val;
            else inp.value = val || '';
          });
        });
      });
    }

    // Restore choices
    if (data.choices) {
      Object.entries(data.choices).forEach(([name, val]) => {
        if (Array.isArray(val)) {
          val.forEach(v => {
            const el = document.querySelector(`input[name="${name}"][value="${v}"]`);
            if (el) el.checked = true;
          });
        } else {
          const el = document.querySelector(`input[name="${name}"][value="${val}"]`);
          if (el) el.checked = true;
        }
      });
    }

    updateProgress();
  }

  /* ─── Collect data ─── */
  function collectFormData() {
    const result = {
      meta: {
        project: document.querySelector('[data-form-id]')?.dataset.projectName || formId,
        form_version: '1.0',
        confirmed_by: document.querySelector('[name="confirmed_by"]')?.value || '',
        confirmed_at: document.querySelector('[name="confirmed_at"]')?.value || '',
        exported_at: new Date().toISOString()
      },
      sections: [],
      free_text: {},
      tables: {},
      choices: {}
    };

    // Collect sections (tri-state confirm items)
    document.querySelectorAll('.sec[data-sec-id]').forEach(sec => {
      const secData = {
        id: sec.dataset.secId,
        title: sec.querySelector('.sec-h h2')?.textContent || '',
        items: []
      };
      sec.querySelectorAll('.confirm-row').forEach(row => {
        const nameAttr = row.querySelector('.tri-state input[type="radio"]')?.name;
        if (!nameAttr) return;
        const checked = row.querySelector('.tri-state input[type="radio"]:checked');
        const comment = row.querySelector('textarea[name="' + nameAttr + '_comment"]');
        secData.items.push({
          id: nameAttr,
          label: row.querySelector('td:nth-child(2)')?.textContent?.trim() || '',
          status: checked ? checked.value : 'unanswered',
          comment: comment ? comment.value : ''
        });
      });
      if (secData.items.length > 0) result.sections.push(secData);
    });

    // Collect free text
    document.querySelectorAll('textarea.form-input[name], input.form-input[name]').forEach(el => {
      result.free_text[el.name] = el.value;
    });

    // Collect editable tables
    document.querySelectorAll('.data-table[id]').forEach(table => {
      const rows = [];
      const headers = [];
      table.querySelectorAll('thead th').forEach(th => {
        headers.push(th.textContent.trim().replace(/\s+/g, '_').toLowerCase());
      });
      table.querySelectorAll('tbody tr').forEach(tr => {
        const row = {};
        const inputs = tr.querySelectorAll('input');
        let idx = 0;
        headers.forEach(h => {
          const inp = inputs[idx++];
          if (!inp) return;
          row[h] = inp.type === 'checkbox' ? inp.checked : inp.value;
        });
        const hasData = Object.values(row).some(v => v !== '' && v !== false);
        if (hasData) rows.push(row);
      });
      if (rows.length > 0) result.tables[table.id] = rows;
    });

    // Collect choice groups (radio / checkbox outside tri-state)
    document.querySelectorAll('.choice-group').forEach(group => {
      const inputs = group.querySelectorAll('input');
      if (inputs.length === 0) return;
      const name = inputs[0].name;
      if (!name) return;
      if (inputs[0].type === 'radio') {
        const checked = group.querySelector('input:checked');
        if (checked) result.choices[name] = checked.value;
      } else {
        const checked = group.querySelectorAll('input:checked');
        if (checked.length) result.choices[name] = Array.from(checked).map(c => c.value);
      }
    });

    // Collect standalone inline inputs
    document.querySelectorAll('.inline-input[name]').forEach(el => {
      if (el.value) result.free_text[el.name] = el.value;
    });

    return result;
  }

  /* ─── Export JSON ─── */
  function exportJSON() {
    const data = collectFormData();
    if (!data.meta.confirmed_at) data.meta.confirmed_at = new Date().toISOString();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formId}_confirm.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('JSON 已导出', 'ok');
  }

  /* ─── Clear form ─── */
  function clearForm() {
    if (!confirm('确定要清空所有已填写内容吗？此操作不可撤销。')) return;
    document.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
    document.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = false);
    document.querySelectorAll('input[type="text"], textarea').forEach(t => t.value = '');
    document.querySelectorAll('.confirm-comment').forEach(c => c.classList.add('hidden'));
    try { localStorage.removeItem(STORAGE_PREFIX + formId); } catch (e) {}
    updateProgress();
    showToast('已清空', 'ok');
  }

  /* ─── Toast ─── */
  function showToast(msg, type) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = 'toast' + (type === 'ok' ? ' toast-ok' : type === 'err' ? ' toast-err' : '');
    requestAnimationFrame(() => {
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2400);
    });
  }

  /* ─── Index page: show saved progress on cards ─── */
  function initIndex() {
    document.querySelectorAll('.project-card[data-form-id]').forEach(card => {
      const id = card.dataset.formId;
      let raw;
      try { raw = localStorage.getItem(STORAGE_PREFIX + id); } catch (e) { return; }
      if (!raw) return;
      let data;
      try { data = JSON.parse(raw); } catch (e) { return; }
      if (!data || !data.sections) return;

      let total = 0, answered = 0;
      data.sections.forEach(sec => {
        sec.items.forEach(item => {
          total++;
          if (item.status !== 'unanswered') answered++;
        });
      });
      if (total === 0) return;
      const pct = Math.round((answered / total) * 100);
      const fill = card.querySelector('.pc-progress-fill');
      const meta = card.querySelector('.pc-meta');
      if (fill) fill.style.width = pct + '%';
      if (meta) meta.textContent = `已填写 ${answered}/${total} 项 · ${pct}%`;
    });
  }

  /* ─── Boot ─── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); initIndex(); });
  } else {
    init(); initIndex();
  }
})();
