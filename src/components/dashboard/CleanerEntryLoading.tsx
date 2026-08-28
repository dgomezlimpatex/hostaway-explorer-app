export const CleanerEntryLoading = () => {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-[#fbfaff] px-5 py-8"
      aria-label="Cargando"
      role="status"
    >
      <div className="loader" aria-hidden="true">
        <p className="loader-text">Cargando</p>
        <span className="load" />
      </div>
    </main>
  );
};

