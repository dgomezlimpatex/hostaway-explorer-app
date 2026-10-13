import type { KeyboardEvent } from "react";

export function handleReceiptQuantityKey(
  event: KeyboardEvent<HTMLInputElement>,
  locked: boolean,
  value: string | undefined,
  onAdd: () => void,
) {
  if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
  event.preventDefault();
  if (!event.repeat && !locked && value?.trim()) onAdd();
}
