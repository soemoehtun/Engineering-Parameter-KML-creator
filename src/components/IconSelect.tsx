

/**
 * Compact palette swatches + free colour picker
 * (Point-File-Creator single-colour Style UI).
 */
export function ColorPalette({
  value,
  onChange,
  colors,
}: {
  value: string;
  onChange: (c: string) => void;
  colors: string[];
}) {
  return (
    <div className="swatch-row">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          title={c}
          className="swatch"
          style={{
            background: c,
            borderColor: value.toLowerCase() === c.toLowerCase() ? "#102f32" : "transparent",
            boxShadow: value.toLowerCase() === c.toLowerCase() ? "0 0 0 1.5px #fff inset" : undefined,
          }}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="color-input mix"
        title="Custom colour"
      />
    </div>
  );
}
