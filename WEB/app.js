/**
 * E-OPTIMIZER : Industrial AI Process, Energy & Carbon Intelligence
 * Minimal Interaction Logic: 3D Mouse Parallax, Technical Modal Drawer, and Login Handler
 */

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // 1. 3D MOUSE PARALLAX ON INDUSTRIAL VISUAL (Smooth subtle physics)
  // =========================================================================
  const floatingIsland = document.getElementById('floating-island');
  const cubeLeft = document.getElementById('cube-left');
  const cubeRight = document.getElementById('cube-right');
  const cubeMini = document.getElementById('cube-mini');
  const cubeTop = document.getElementById('cube-top');
  const bgTypo = document.getElementById('bg-typo');

  let targetRotX = 0;
  let targetRotY = 0;
  let curRotX = 0;
  let curRotY = 0;

  window.addEventListener('mousemove', (e) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const mouseX = (e.clientX - cx) / cx;
    const mouseY = (e.clientY - cy) / cy;

    // Very subtle, refined industrial tilt (max 8 degrees)
    targetRotX = -mouseY * 8;
    targetRotY = mouseX * 10;
  });

  function renderParallax() {
    curRotX += (targetRotX - curRotX) * 0.06;
    curRotY += (targetRotY - curRotY) * 0.06;

    if (floatingIsland) {
      floatingIsland.style.transform = `rotateX(${curRotX.toFixed(2)}deg) rotateY(${curRotY.toFixed(2)}deg)`;
    }

    if (cubeLeft) {
      cubeLeft.style.transform = `translate3d(${(-curRotY * 1.2).toFixed(1)}px, ${(curRotX * 1.2).toFixed(1)}px, 20px) rotate(${-9 + curRotY * 0.3}deg)`;
    }

    if (cubeRight) {
      cubeRight.style.transform = `translate3d(${(curRotY * 1.5).toFixed(1)}px, ${(-curRotX * 1.4).toFixed(1)}px, 30px) rotate(${11 - curRotY * 0.4}deg)`;
    }

    if (cubeMini) {
      cubeMini.style.transform = `translate3d(${(-curRotY * 0.6).toFixed(1)}px, ${(-curRotX * 0.8).toFixed(1)}px, 15px) rotate(${-14 + curRotX * 0.5}deg)`;
    }

    if (cubeTop) {
      cubeTop.style.transform = `translate3d(${(curRotY * 0.4).toFixed(1)}px, ${(-curRotX * 0.5).toFixed(1)}px, 35px) rotate(${18 - curRotY * 0.3}deg)`;
    }

    if (bgTypo) {
      bgTypo.style.transform = `translate3d(${(-curRotY * 0.9).toFixed(1)}px, ${(curRotX * 0.6).toFixed(1)}px, 0)`;
    }

    requestAnimationFrame(renderParallax);
  }

  if (floatingIsland) {
    renderParallax();
  }

  // =========================================================================
  // 2. BOOK A DEMO MODAL / DRAWER
  // =========================================================================
  const demoModal = document.getElementById('demo-modal');
  const bookDemoBtn = document.getElementById('book-demo-btn');
  const closeDemoBtn = document.getElementById('close-demo-btn');
  const demoBackdrop = document.getElementById('demo-backdrop');
  const footerDemoLink = document.getElementById('footer-demo-link');
  const demoForm = document.getElementById('demo-form');
  const demoSuccessAlert = document.getElementById('demo-success-alert');

  function openDemoDrawer() {
    if (demoModal) {
      demoModal.classList.add('active');
      demoModal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeDemoDrawer() {
    if (demoModal) {
      demoModal.classList.remove('active');
      demoModal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  }

  if (bookDemoBtn) bookDemoBtn.addEventListener('click', openDemoDrawer);
  if (closeDemoBtn) closeDemoBtn.addEventListener('click', closeDemoDrawer);
  if (demoBackdrop) demoBackdrop.addEventListener('click', closeDemoDrawer);
  if (footerDemoLink) {
    footerDemoLink.addEventListener('click', (e) => {
      e.preventDefault();
      openDemoDrawer();
    });
  }

  if (demoForm) {
    demoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('submit-demo-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      setTimeout(() => {
        submitBtn.style.display = 'none';
        demoSuccessAlert.style.display = 'block';
      }, 600);
    });
  }

  // Escape key listener for modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDemoDrawer();
    }
  });

  // =========================================================================
  // 3. OPERATOR LOGIN HANDLER (login.html)
  // =========================================================================
  const loginForm = document.getElementById('login-form');
  const loginSuccessAlert = document.getElementById('login-success-alert');
  const signInBtn = document.getElementById('sign-in-btn');
  const signUpBtn = document.getElementById('sign-up-btn');
  const authTitle = document.getElementById('auth-title');
  const nameField = document.getElementById('name-field');
  const userName = document.getElementById('user-name');
  const loginSubmitBtn = document.getElementById('login-submit-btn');
  let authMode = 'signin';

  function setAuthMode(mode) {
    authMode = mode;
    const isSignUp = mode === 'signup';
    signInBtn.classList.toggle('active', !isSignUp);
    signUpBtn.classList.toggle('active', isSignUp);
    signInBtn.setAttribute('aria-selected', String(!isSignUp));
    signUpBtn.setAttribute('aria-selected', String(isSignUp));
    nameField.hidden = !isSignUp;
    userName.required = isSignUp;
    authTitle.textContent = isSignUp ? 'Create your account' : 'Welcome back';
    loginSubmitBtn.querySelector('span').textContent = isSignUp ? 'Sign up' : 'Sign in';
  }

  if (signInBtn && signUpBtn) {
    signInBtn.addEventListener('click', () => setAuthMode('signin'));
    signUpBtn.addEventListener('click', () => setAuthMode('signup'));
  }

  const loginErrorAlert = document.getElementById('login-error-alert');

  function showAuthError(message) {
    if (!loginErrorAlert) return;
    loginErrorAlert.querySelector('p').textContent = message;
    loginErrorAlert.style.display = 'block';
  }

  function clearAuthError() {
    if (loginErrorAlert) loginErrorAlert.style.display = 'none';
  }

  function showAuthSuccess(heading, message) {
    loginSuccessAlert.querySelector('.cad-code').textContent = heading;
    loginSuccessAlert.querySelector('p').textContent = message;
    loginSuccessAlert.style.display = 'block';
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthError();

      const submitBtn = document.getElementById('login-submit-btn');
      const email = document.getElementById('user-email').value.trim();
      const password = document.getElementById('user-password').value;
      const fullName = userName ? userName.value.trim() : '';

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>${authMode === 'signup' ? 'Creating account...' : 'Signing in...'}</span>`;

      function failed() {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>${authMode === 'signup' ? 'Sign up' : 'Sign in'}</span>`;
      }

      const { signUp, signIn } = await import('@backend/auth.js');

      if (authMode === 'signup') {
        const { error, needsEmailConfirmation } = await signUp({ email, password, fullName });

        if (error) {
          showAuthError(error);
          failed();
          return;
        }

        if (needsEmailConfirmation) {
          submitBtn.style.display = 'none';
          showAuthSuccess(
            'CONFIRM YOUR EMAIL',
            "Almost there. Click the link we just sent to " + email + ", then come back and sign in."
          );
          return;
        }
      } else {
        const { error } = await signIn({ email, password });

        if (error) {
          showAuthError(error);
          failed();
          return;
        }
      }

      submitBtn.style.display = 'none';
      showAuthSuccess(
        authMode === 'signup' ? 'ACCOUNT CREATED' : 'SIGNED IN',
        authMode === 'signup'
          ? "You're all set. Taking you to your plant now..."
          : "Signed in. Taking you to your plant now..."
      );

      setTimeout(() => {
        window.location.href = '/dashboard/';
      }, 1200);
    });
  }
});
