export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="footer-content">
        <p className="footer-text">
          © {currentYear} <strong>Hansam (Sam) Jo</strong>. Licensed under{' '}
          <a 
            href="https://opensource.org/licenses/MIT" 
            target="_blank" 
            rel="noopener noreferrer"
            className="footer-link"
          >
            MIT License
          </a>
          .
        </p>
      </div>
    </footer>
  )
}
