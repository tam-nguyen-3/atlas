export function MultiSelection({
  legend,
  options,
  value,
  onChange,
  disabled,
  error,
  id,
}: {
  legend: string;
  options: readonly { slug: string; name: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  error?: string;
  id: string;
}) {
  return (
    <fieldset
      className="multi-selection"
      id={`${id}-group`}
      disabled={disabled}
      aria-describedby={`${id}-help`}
      aria-invalid={!!error}
    >
      <legend>{legend}</legend>
      <div className="selection-options">
        {options.map((option) => (
          <label key={option.slug}>
            <input
              type="checkbox"
              checked={value.includes(option.slug)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...value, option.slug]
                    : value.filter((slug) => slug !== option.slug),
                )
              }
            />
            {option.name}
          </label>
        ))}
      </div>
      <p
        id={`${id}-help`}
        className={error ? "error-text field-help" : "muted field-help"}
      >
        {error ??
          (id === "cities"
            ? "No cities selected means General."
            : "Choose at least one category.")}
      </p>
    </fieldset>
  );
}
