// The fictional shop used in this demo. Everything about it is made up.
// このデモの架空のお店。中身はすべて作り物。

export const SHOP = {
  id: "demo-cafe",
  name: "架空のカフェ",
} as const;

/** Name of the owner's yardstick skill: `.claude/skills/<shop>-monosashi/SKILL.md`. */
export const SKILL_NAME = `${SHOP.id}-monosashi`;
