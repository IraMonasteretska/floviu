(function ($) {
  const $header = $('.header');
  const scrollClass = 'header--scrolled';

  function toggleHeaderScroll() {
    $header.toggleClass(scrollClass, $(window).scrollTop() > 0);
  }

  toggleHeaderScroll();
  $(window).on('scroll', toggleHeaderScroll);


  // Mobile menu
  function openMobileMenu() {
    $('.menu-overlay, .header__nav ').addClass('open');
    $('body').addClass('menu-open');
}

function closeMobileMenu() {
    $('.menu-overlay, .header__nav ').removeClass('open');
    $('body').removeClass('menu-open');
}

$('.mebubtn').click(openMobileMenu);
$('.closemenu, .menu-overlay').click(closeMobileMenu);



  // Img fade in on scroll
  const scrollMedia = document.querySelectorAll('.section__media');

  if (scrollMedia.length) {
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !('IntersectionObserver' in window)
    ) {
      scrollMedia.forEach((media) => media.classList.add('section__media--in-view'));
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              return;
            }

            entry.target.classList.add('section__media--in-view');
            observer.unobserve(entry.target);
          });
        },
        {
          threshold: 0.15,
          rootMargin: '0px 0px -8% 0px',
        }
      );

      scrollMedia.forEach((media) => observer.observe(media));
    }
  }


  // Focus World timeline
  const timeline = document.querySelector('.timeline');

  if (timeline) {
    const stages = timeline.querySelectorAll('.timeline__stage');
    const dots = timeline.querySelectorAll('.timeline__dot');

    function setActiveStage(index) {
      const activeIndex = String(index);

      stages.forEach((stage, i) => {
        const isActive = String(i) === activeIndex;
        stage.classList.toggle('is-active', isActive);
        stage.setAttribute('aria-selected', isActive ? 'true' : 'false');
        stage.setAttribute('tabindex', isActive ? '0' : '-1');
      });

      dots.forEach((dot) => {
        dot.classList.toggle('is-active', dot.dataset.stage === activeIndex);
      });

      const activeStage = stages[Number(activeIndex)];
      if (activeStage) {
        activeStage.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest',
        });
      }
    }

    dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        setActiveStage(dot.dataset.stage);
      });
    });

    stages.forEach((stage) => {
      stage.addEventListener('click', () => {
        setActiveStage(stage.dataset.stage);
      });

      stage.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }

        event.preventDefault();
        setActiveStage(stage.dataset.stage);
      });
    });
  }

  // testimonials slider
  var swiper = new Swiper('.testimonials-slider', {
    slidesPerView: 1,
    spaceBetween: 24,
    speed: 700,
    // loop: true,
    navigation: {
      nextEl: '.swiper-button-next.headarr',
      prevEl: '.swiper-button-prev.headarr',
    },
    // autoplay: {
    //   delay: 4500,
    //   disableOnInteraction: false,
    // },
    breakpoints: {
      576: {
        slidesPerView: 1.5,
        spaceBetween: 20,
      },
      768: {
        slidesPerView: 2,
      },
      992: {
        slidesPerView: 2.5,
      },
    },
  });

  // FAQ
  const $faqItems = $('.faq__item');
  if ($faqItems.length) {
    const openClass = 'open';

    $faqItems.each(function () {
      const $item = $(this);
      const $body = $item.find('.faq__item-body').first();
      if (!$body.length) return;

      if ($item.hasClass(openClass)) {
        $body.show();
      } else {
        $body.hide();
      }
    });

    $(document).on('click', '.faq__item-header', function (e) {
      e.preventDefault();

      const $item = $(this).closest('.faq__item');
      const $body = $item.find('.faq__item-body').first();
      if (!$body.length) return;

      const isOpen = $item.hasClass(openClass);

      $faqItems.not($item).removeClass(openClass).find('.faq__item-body').stop(true, true).slideUp(400);

      if (isOpen) {
        $item.removeClass(openClass);
        $body.stop(true, true).slideUp(400);
      } else {
        $item.addClass(openClass);
        $body.stop(true, true).slideDown(400);
      }
    });
  }

  // select 2
  if ($('select').length) {
    $('.styledselect').select2({
      // placeholder: "",
      minimumResultsForSearch: Infinity,
      dropdownParent: $('.formwrapper')
    });
  }

  // Inline video play (для варіанту з кнопкою play)
  // $(document).on('click', '.videowrap__play', function () {
  //   const $wrap = $(this).closest('.videowrap');
  //   const videoEl = $wrap.find('.videowrap__video').get(0);

  //   if (!videoEl) {
  //     return;
  //   }

  //   const playPromise = videoEl.play();
  //   if (playPromise && typeof playPromise.catch === 'function') {
  //     playPromise.catch(function () {});
  //   }
  // });

  // $(document).on('play', '.videowrap__video', function () {
  //   $(this).closest('.videowrap').addClass('is-playing');
  // });

  // $(document).on('pause ended', '.videowrap__video', function () {
  //   $(this).closest('.videowrap').removeClass('is-playing');
  // });



  // Download popups (pricing)
  $(document).on('click', '[data-popup-open]', function () {
    const popupId = $(this).attr('data-popup-open');
    const $popup = $('#' + popupId);

    if (!$popup.length) {
      return;
    }

    $('.download-popup.is-open').removeClass('is-open');
    $popup.addClass('is-open');
    $('body').addClass('popup-open');
  });

  $(document).on('click', '[data-popup-close]', function () {
    $(this).closest('.download-popup').removeClass('is-open');

    if (!$('.download-popup.is-open').length) {
      $('body').removeClass('popup-open');
    }
  });

  $(document).on('keydown', function (e) {
    if (e.key !== 'Escape') {
      return;
    }

    const $openPopup = $('.download-popup.is-open');

    if (!$openPopup.length) {
      return;
    }

    $openPopup.removeClass('is-open');
    $('body').removeClass('popup-open');
  });
})(jQuery);
