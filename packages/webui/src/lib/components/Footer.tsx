import { Link } from 'react-router';
import { useEffect, useState } from 'react';
import IconSocial from './IconSocial.js';
import ThemeToggle from './ThemeToggle.js';
export default function Footer() {
	const [isDark, setDark] = useState(false);
	useEffect(() => {
		const update = () => setDark(document.documentElement.classList.contains('dark'));
		const observer = new MutationObserver(update);
		update();
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
		return () => observer.disconnect();
	}, []);
	return (
		<>
			<footer className="bg-base-200 py-6 pb-20 text-base-content md:pb-6">
				<div className="container mx-auto px-4">
					<div className="mb-4 flex flex-col items-center justify-center">
						<div>
							<div className="mb-6 flex flex-col items-center">
								<Link to="/" className="flex flex-col items-center">
									<div className="relative mb-2 h-16 w-16">
										<img src="/favicon.svg" alt="ak5-web Icon" className="object-contain" />
									</div>
									<span className="text-3xl font-bold text-secondary transition-all duration-300 hover:text-primary">
										ak5-web
									</span>
								</Link>
							</div>
							<p className="mb-6 text-center text-base-content/60">Your tagline goes here.</p>
							{/* Replace these with your own social links (or delete the row). */}
							<div className="flex justify-center space-x-4">
								<IconSocial
									platform="x"
									url="https://x.com/yourhandle"
									color={isDark ? 'white' : 'black'}
								/>
								<IconSocial platform="youtube" url="https://www.youtube.com/@yourhandle" />
							</div>
						</div>
					</div>

					<div className="space-y-2 border-t border-base-content/20 pt-4 text-center">
						<div className="text-sm">
							<ThemeToggle />
						</div>
						<p className="text-xs text-base-content/60">
							&copy; {new Date().getFullYear()} ak5-web. All rights reserved.
						</p>
					</div>
				</div>
			</footer>
		</>
	);
}
