// BAPAS Kelas I Medan - Main JavaScript

// ============ SLIDER ============
(function() {
  const track = document.querySelector('.slider-track');
  const slides = document.querySelectorAll('.slide');
  const dots = document.querySelectorAll('.dot');
  if (!track || !slides.length) return;

  let current = 0;
  let timer;

  function goTo(n) {
    slides[current].classList.remove('active');
    dots[current] && dots[current].classList.remove('active');
    current = (n + slides.length) % slides.length;
    slides[current].classList.add('active');
    dots[current] && dots[current].classList.add('active');
    track.style.transform = `translateX(-${current * 100}%)`;
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  function startTimer() { timer = setInterval(next, 5000); }
  function resetTimer() { clearInterval(timer); startTimer(); }

  document.querySelector('.slider-next') && document.querySelector('.slider-next').addEventListener('click', () => { next(); resetTimer(); });
  document.querySelector('.slider-prev') && document.querySelector('.slider-prev').addEventListener('click', () => { prev(); resetTimer(); });

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => { goTo(i); resetTimer(); });
  });

  slides[0].classList.add('active');
  dots[0] && dots[0].classList.add('active');
  startTimer();
})();

// ============ HAMBURGER ============
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');
if (hamburger && navMenu) {
  hamburger.addEventListener('click', () => {
    navMenu.classList.toggle('open');
    hamburger.innerHTML = navMenu.classList.contains('open')
      ? '<i class="fas fa-times"></i>'
      : '<i class="fas fa-bars"></i>';
  });
}

// Mobile dropdown toggle
document.querySelectorAll('.has-dropdown > a').forEach(link => {
  link.addEventListener('click', (e) => {
    if (window.innerWidth <= 992) {
      e.preventDefault();
      const dropdown = link.nextElementSibling;
      if (dropdown) {
        const isShown = dropdown.style.display === 'block';
        dropdown.style.display = isShown ? 'none' : 'block';
        const arrow = link.querySelector('i.arrow');
        if (arrow) {
          arrow.style.transform = isShown ? 'rotate(0deg)' : 'rotate(180deg)';
        }
      }
    }
  });
});

// ============ COUNTER ANIMATION ============
function animateCount(el, target, suffix='') {
  let count = 0;
  const step = Math.ceil(target / 60);
  const timer = setInterval(() => {
    count += step;
    if (count >= target) { count = target; clearInterval(timer); }
    el.textContent = count.toLocaleString('id-ID') + suffix;
  }, 20);
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const nums = entry.target.querySelectorAll('.stat-number');
      nums.forEach(num => {
        const val = parseInt(num.dataset.val);
        const suf = num.dataset.suf || '';
        if (val) animateCount(num, val, suf);
      });
      observer.unobserve(entry.target);
    }
  });
});

const statsSection = document.querySelector('.quick-stats');
if (statsSection) observer.observe(statsSection);

// ============ STICKY NAVBAR SHADOW ============
window.addEventListener('scroll', () => {
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    navbar.style.boxShadow = window.scrollY > 10 
      ? '0 4px 20px rgba(0,0,0,0.25)' 
      : '0 3px 15px rgba(0,0,0,0.2)';
  }
});

// ============ SCROLL REVEAL ============
const revealEls = document.querySelectorAll('.news-card, .layanan-card, .pejabat-card, .alur-step');
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }, i * 80);
      revealObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

revealEls.forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  revealObs.observe(el);
});
