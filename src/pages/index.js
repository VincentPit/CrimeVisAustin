import Head from "next/head";
import Link from "next/link";
import styles from "@/styles/Home.module.css";

export default function Home() {
  return (
    <>
      <Head>
        <title>Austin Crime 2015 Visualization</title>
        <meta name="description" content="Explore Austin Crime Data Visualizations" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={styles.page}>
        <main className={styles.main}>
          <h1>Austin Crime Data Visualizations of 2015</h1>

          {/* Navigation Bar */}
          <nav className={styles.navbar}>
            <ul className={styles.link}>
                  <Link href="/mainView2"> Click to see the Main View</Link> 
            </ul>
          </nav>
        </main>
        <footer className={styles.footer}>
          <p>&copy; Fall 2024 DATS-SHU-235 Austin Crime Visualization</p>
        </footer>
      </div>
    </>
  );
}
