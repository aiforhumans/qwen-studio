export function focusControl(id?: string) {
  if (!id) return;
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("focus-flash");
  void el.offsetWidth;
  el.classList.add("focus-flash");
  const f = el.matches("input,select,button,textarea")
    ? el
    : el.querySelector<HTMLElement>("input,select,button,textarea");
  f?.focus({ preventScroll: true });
}
