import { useState } from "react";
import { Ingredient } from "~/app/components/types";

interface Props {
  allIngredients: Ingredient[];
  value: Ingredient[];
  onChange: (selected: Ingredient[]) => void;
}

export function IngredientsMultiSelect({
  allIngredients,
  value,
  onChange,
}: Props) {
  const [search, setSearch] = useState("");

  // Filter available options based on search and already selected
  const filteredOptions = allIngredients.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) &&
      !value.some((selected) => selected.id === i.id),
  );

  const handleSelect = (ingredient: Ingredient) => {
    onChange([...value, ingredient]);
    setSearch(""); // optional: clear search after selection
  };

  const handleRemove = (id: string) => {
    onChange(value.filter((i) => i.id !== id));
  };

  return (
    <div className="rounded border p-2">
      <div className="mb-2 flex flex-wrap gap-2">
        {value.map((ingredient) => (
          <div
            key={ingredient.id}
            className="flex items-center gap-1 rounded bg-gray-200 px-2 py-1 hover:cursor-pointer"
            onClick={() => handleRemove(ingredient.id)}
          >
            {ingredient.name}
            <button type="button" className="font-bold text-red-500">
              ×
            </button>
          </div>
        ))}
      </div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search ingredients..."
        className="mb-2 w-full border p-1"
      />
      <div className="max-h-40 overflow-y-auto border-t pt-1">
        {filteredOptions.map((ingredient) => (
          <div
            key={ingredient.id}
            onClick={() => handleSelect(ingredient)}
            className="cursor-pointer p-1 hover:bg-gray-100"
          >
            {ingredient.name} ({ingredient.chineseName})
          </div>
        ))}
        {filteredOptions.length === 0 && (
          <div className="p-1 text-gray-400">No results</div>
        )}
      </div>
    </div>
  );
}
