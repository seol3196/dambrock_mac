export default function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-stone-700">{label}</span>
      {children}
    </label>
  );
}
