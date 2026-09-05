interface UserHeaderProps {
  firstName: string;
  username: string | null;
  photoUrl: string | null;
}

export function UserHeader({
  firstName,
  username,
  photoUrl,
}: UserHeaderProps): React.ReactNode {
  return (
    <header className="flex items-center gap-3 py-2">
      {photoUrl ? (
        <div
          role="img"
          aria-label={`${firstName}'s Telegram profile photo`}
          className="size-12 shrink-0 rounded-full bg-cover bg-center ring-2 ring-[var(--tg-theme-button-color,#3390ec)]/20"
          style={{
            backgroundImage: `url(${JSON.stringify(photoUrl).slice(1, -1)})`,
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--tg-theme-button-color,#3390ec)] text-lg font-semibold text-[var(--tg-theme-button-text-color,#fff)]"
        >
          {firstName.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold">Hello, {firstName}</p>
        {username ? (
          <p className="truncate text-sm text-[var(--tg-theme-hint-color,#8e8e93)]">
            @{username}
          </p>
        ) : null}
      </div>
    </header>
  );
}
