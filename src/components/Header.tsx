import { useAuth } from "@/auth/AuthContext";

const Header = () => {
  const { user, signOut } = useAuth();

  return (
    <header className="w-full flex items-center justify-between px-8 py-4 border-b border-slate-200 bg-white font-rubik">
      <h1 className="text-xl font-semibold text-slate-800">Kanban</h1>
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-500">{user?.email}</span>
        <button
          onClick={signOut}
          className="text-sm font-medium text-slate-500 hover:text-rose-500 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
};

export default Header;
