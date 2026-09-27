(function () {
  var base = {
    buttonsStyling: false,
    reverseButtons: true,
    focusCancel: true,
    customClass: {
      popup: 'mg-swal',
      title: 'mg-swal-title',
      htmlContainer: 'mg-swal-text',
      actions: 'mg-swal-actions',
      icon: 'mg-swal-icon',
      cancelButton: 'mg-swal-btn is-ghost',
    },
  };

  function ready() {
    return typeof Swal !== 'undefined';
  }

  window.mgConfirm = function (opts) {
    if (!ready()) return Promise.resolve(window.confirm(opts.text || opts.title));
    return Swal.fire(Object.assign({}, base, {
      title: opts.title || '¿Confirmás?',
      text: opts.text || '',
      icon: opts.icon || 'warning',
      showCancelButton: true,
      confirmButtonText: opts.confirmText || 'Confirmar',
      cancelButtonText: opts.cancelText || 'Cancelar',
      customClass: Object.assign({}, base.customClass, {
        confirmButton: opts.danger ? 'mg-swal-btn is-danger' : 'mg-swal-btn is-accent',
      }),
    })).then(function (result) {
      return Boolean(result.isConfirmed);
    });
  };

  window.mgToast = function (opts) {
    if (!ready()) return;
    return Swal.fire({
      toast: true,
      position: 'top-end',
      icon: opts.icon || 'success',
      title: opts.title || '',
      showConfirmButton: false,
      timer: 2800,
      timerProgressBar: true,
      customClass: {
        popup: 'mg-swal is-toast',
        title: 'mg-swal-title',
        timerProgressBar: 'mg-swal-timer',
      },
    });
  };

  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.hasAttribute('data-swal-title')) return;
    if (form.getAttribute('data-swal-ok') === '1') return;
    event.preventDefault();
    window.mgConfirm({
      title: form.getAttribute('data-swal-title'),
      text: form.getAttribute('data-swal-text') || '',
      icon: form.getAttribute('data-swal-icon') || 'warning',
      confirmText: form.getAttribute('data-swal-confirm') || 'Confirmar',
      cancelText: form.getAttribute('data-swal-cancel') || 'Cancelar',
      danger: form.hasAttribute('data-swal-danger'),
    }).then(function (ok) {
      if (!ok) return;
      form.setAttribute('data-swal-ok', '1');
      if (typeof form.requestSubmit === 'function') form.requestSubmit();
      else form.submit();
    });
  });

  document.addEventListener('DOMContentLoaded', function () {
    var flash = document.getElementById('mg-swal-flash');
    if (!flash) return;
    window.mgToast({
      title: flash.getAttribute('data-title') || '',
      icon: flash.getAttribute('data-icon') || 'success',
    });
  });
})();
