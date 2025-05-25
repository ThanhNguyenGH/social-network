document.addEventListener('DOMContentLoaded', function () {
    const isBannedCheckbox = document.getElementById('isBanned');
    const banReasonSelect = document.getElementById('banReason');

    // Set trạng thái banReason khi trang load
    banReasonSelect.disabled = !isBannedCheckbox.checked;

    // Khi thay đổi checkbox
    isBannedCheckbox.addEventListener('change', function () {
        banReasonSelect.disabled = !this.checked;

        if (!this.checked) {
            banReasonSelect.value = '';
        }
    });
});

document.addEventListener('DOMContentLoaded', function () {
  const deleteForms = document.querySelectorAll('form[action^="/admin/users/delete"]');

  deleteForms.forEach(form => {
    form.addEventListener('submit', function (e) {
      const confirmed = confirm('Bạn có chắc muốn xóa người dùng này?');
      if (!confirmed) {
        e.preventDefault();
      }
    });
  });
});