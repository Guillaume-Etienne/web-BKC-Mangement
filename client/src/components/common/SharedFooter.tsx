/** Credit line shown under every public share page (rendered once, in App.tsx,
 *  so a new share page gets it without anyone remembering to add it). */
export default function SharedFooter() {
  return (
    <footer className="h-12 flex items-center justify-center bg-gray-50 dark:bg-gray-950 text-xs text-gray-400 dark:text-gray-500">
      <a href="https://airtricksprod.fr/" target="_blank" rel="noopener noreferrer"
        className="hover:text-gray-600 dark:hover:text-gray-300 hover:underline">
        Made by airtricksprod.fr
      </a>
    </footer>
  )
}
