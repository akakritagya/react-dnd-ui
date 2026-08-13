import Header from "./Header";
import DnDContainer from "./DnDContainer";

const BoardPage = () => (
  <div className="w-screen min-h-screen bg-slate-50 flex flex-col font-rubik">
    <Header />
    <main className="flex-1 flex flex-col items-center py-8 gap-4">
      <DnDContainer />
    </main>
  </div>
);

export default BoardPage;
