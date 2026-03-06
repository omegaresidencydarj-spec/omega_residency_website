(function () {
  var menuBtn = document.getElementById('menuBtn');
  var navLinks = document.getElementById('navLinks');
  var yearEls = document.querySelectorAll('.year');
  var page = document.body.getAttribute('data-page');

  yearEls.forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  if (page) {
    document.querySelectorAll('.nav-links a[data-page]').forEach(function (a) {
      if (a.getAttribute('data-page') === page) {
        a.classList.add('active');
      }
    });
  }

  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', function () {
      var open = navLinks.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  document.querySelectorAll('.nav-links a').forEach(function (a) {
    a.addEventListener('click', function () {
      if (navLinks) navLinks.classList.remove('open');
      if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
    });
  });

  if (page === 'home' || page === 'about') {
    document.querySelectorAll('.rotating-card').forEach(function (card) {
      var img = card.querySelector('img');
      var imageList = (card.getAttribute('data-images') || '').split('|').filter(Boolean);
      var altList = (card.getAttribute('data-alts') || '').split('|').filter(Boolean);
      var index = 0;

      if (!img || imageList.length < 2) return;

      setInterval(function () {
        index = (index + 1) % imageList.length;
        img.classList.add('swap-fade');
        window.setTimeout(function () {
          img.src = imageList[index];
          img.alt = altList[index] || img.alt;
          img.classList.remove('swap-fade');
        }, 180);
      }, 7000);
    });
  }

  if (page === 'rooms') {
    var checkinEl = document.getElementById('checkinDate');
    var checkoutEl = document.getElementById('checkoutDate');
    var checkinDisplay = document.getElementById('checkinDisplay');
    var checkoutDisplay = document.getElementById('checkoutDisplay');
    var roomTypeEl = document.getElementById('roomType');
    var guestsEl = document.getElementById('guestsCount');
    var titleEl = document.getElementById('titleSelect');
    var firstNameEl = document.getElementById('firstName');
    var lastNameEl = document.getElementById('lastName');
    var emailEl = document.getElementById('guestEmail');
    var phoneEl = document.getElementById('guestPhone');
    var specialReqEl = document.getElementById('specialRequest');
    var addonsChecks = document.querySelectorAll('.addon-check');
    var addonsQty = document.querySelectorAll('.addon-qty');
    var sumRoom = document.getElementById('sumRoom');
    var sumNights = document.getElementById('sumNights');
    var sumBase = document.getElementById('sumBase');
    var sumAddons = document.getElementById('sumAddons');
    var sumTotal = document.getElementById('sumTotal');
    var waQuoteBtn = document.getElementById('whatsAppQuoteBtn');
    var roomPickBtns = document.querySelectorAll('.book-room-btn');
    var stepPills = document.querySelectorAll('.step-pill');
    var stageEls = document.querySelectorAll('.booking-stage');
    var bookingHint = document.getElementById('bookingHint');
    var toStep2Btn = document.getElementById('toStep2');
    var toStep3Btn = document.getElementById('toStep3');
    var backToStep1Btn = document.getElementById('backToStep1');
    var backToStep2Btn = document.getElementById('backToStep2');
    var confirmGuest = document.getElementById('confirmGuest');
    var confirmRoom = document.getElementById('confirmRoom');
    var confirmDates = document.getElementById('confirmDates');
    var confirmGuests = document.getElementById('confirmGuests');
    var confirmAddons = document.getElementById('confirmAddons');
    var confirmTotal = document.getElementById('confirmTotal');
    var calendarModal = document.getElementById('calendarModal');
    var calendarGrid = document.getElementById('calendarGrid');
    var calendarMonthLabel = document.getElementById('calendarMonthLabel');
    var calendarHelp = document.getElementById('calendarHelp');
    var calendarPrev = document.getElementById('calendarPrev');
    var calendarNext = document.getElementById('calendarNext');
    var calendarCancel = document.getElementById('calendarCancel');

    var roomLabels = {
      maple: 'Maple Deluxe (E/P Plan)',
      olive: 'Olive Suite (E/P Plan)',
      pine: 'Pine Suite (E/P Plan)'
    };

    var tariffFallback = { maple: 7000, olive: 10000, pine: 10000 };
    var addonRates = {
      extra_bed: 1000,
      heater: 500,
      hot_bag: 100,
      bed_blanket: 300,
      combo: 700,
      meals: 600
    };

    var seasonal = [
      { name: 'Late Winter', from: '01-03', to: '03-31', rates: { maple: 1800, olive: 3000, pine: 3000 } },
      { name: 'Spring Peak', from: '04-01', to: '04-20', rates: { maple: 1950, olive: 3450, pine: 3450 } },
      { name: 'Summer Peak', from: '04-21', to: '06-10', rates: { maple: 4100, olive: 7100, pine: 7100 } },
      { name: 'Monsoon', from: '06-10', to: '09-25', rates: { maple: 1900, olive: 3300, pine: 3300 } },
      { name: 'Autumn Peak', from: '09-25', to: '11-01', rates: { maple: 4100, olive: 7200, pine: 7200 } },
      { name: 'Early Winter', from: '11-01', to: '12-20', rates: { maple: 1950, olive: 3450, pine: 3450 } },
      { name: 'Year-End Peak', from: '12-20', to: '01-02', rates: { maple: 4100, olive: 7100, pine: 7100 } }
    ];

    var currentStep = 1;
    var maxUnlockedStep = 1;
    var lastTotals = { room: 'maple', guests: 2, nights: 0, base: 0, addons: 0, total: 0 };

    var formatInr = function (v) { return '₹' + Math.round(v).toLocaleString('en-IN'); };
    var setHint = function (text) { if (bookingHint) bookingHint.textContent = text || ''; };
    var toKey = function (d) {
      var m = String(d.getMonth() + 1).padStart(2, '0');
      var day = String(d.getDate()).padStart(2, '0');
      return m + '-' + day;
    };
    var isInSeason = function (key, from, to) {
      if (from <= to) return key >= from && key <= to;
      return key >= from || key <= to;
    };
    var getNightRate = function (room, dateObj) {
      var key = toKey(dateObj);
      for (var i = 0; i < seasonal.length; i += 1) {
        if (isInSeason(key, seasonal[i].from, seasonal[i].to)) {
          return seasonal[i].rates[room];
        }
      }
      return tariffFallback[room];
    };

    var pad = function (n) { return String(n).padStart(2, '0'); };
    var toIso = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    var fromIso = function (iso) {
      if (!iso) return null;
      var d = new Date(iso + 'T00:00:00');
      return Number.isNaN(d.getTime()) ? null : d;
    };
    var startOfDay = function (d) {
      var out = new Date(d);
      out.setHours(0, 0, 0, 0);
      return out;
    };
    var addDays = function (d, days) {
      var out = new Date(d);
      out.setDate(out.getDate() + days);
      return startOfDay(out);
    };
    var sameDay = function (a, b) {
      return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    };
    var formatDateLabel = function (iso) {
      var d = fromIso(iso);
      if (!d) return '';
      return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    };

    var today = startOfDay(new Date());
    var tomorrow = addDays(today, 1);
    var calendarState = { field: 'checkin', month: new Date(today.getFullYear(), today.getMonth(), 1) };

    var parseDates = function () {
      var checkin = checkinEl && checkinEl.value ? fromIso(checkinEl.value) : null;
      var checkout = checkoutEl && checkoutEl.value ? fromIso(checkoutEl.value) : null;
      return { checkin: checkin, checkout: checkout };
    };

    var updateDateBounds = function () {
      if (!checkinEl || !checkoutEl) return;
      var ci = fromIso(checkinEl.value);
      var co = fromIso(checkoutEl.value);
      if (ci) {
        var minCheckout = addDays(ci, 1);
        if (!co || co <= ci) {
          checkoutEl.value = toIso(minCheckout);
        }
      }
    };

    var updateDateDisplays = function () {
      if (checkinDisplay) {
        var checkinLabel = checkinDisplay.querySelector('.calendar-trigger-label');
        if (checkinLabel) {
          checkinLabel.textContent = checkinEl && checkinEl.value ? formatDateLabel(checkinEl.value) : 'Select check-in date';
        }
        checkinDisplay.classList.toggle('has-value', !!(checkinEl && checkinEl.value));
      }
      if (checkoutDisplay) {
        var checkoutLabel = checkoutDisplay.querySelector('.calendar-trigger-label');
        if (checkoutLabel) {
          checkoutLabel.textContent = checkoutEl && checkoutEl.value ? formatDateLabel(checkoutEl.value) : 'Select check-out date';
        }
        checkoutDisplay.classList.toggle('has-value', !!(checkoutEl && checkoutEl.value));
      }
    };

    var getCalendarMinDate = function (field) {
      if (field === 'checkout') {
        var ci = fromIso(checkinEl && checkinEl.value);
        return ci ? addDays(ci, 1) : tomorrow;
      }
      return today;
    };

    var closeCalendar = function () {
      if (!calendarModal) return;
      calendarModal.hidden = true;
      document.body.classList.remove('calendar-open');
      if (checkinDisplay) checkinDisplay.setAttribute('aria-expanded', 'false');
      if (checkoutDisplay) checkoutDisplay.setAttribute('aria-expanded', 'false');
    };

    var renderCalendar = function () {
      if (!calendarGrid || !calendarMonthLabel) return;
      calendarGrid.innerHTML = '';

      var viewYear = calendarState.month.getFullYear();
      var viewMonth = calendarState.month.getMonth();
      var firstDay = new Date(viewYear, viewMonth, 1);
      var startWeekday = firstDay.getDay();
      var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      var minDate = getCalendarMinDate(calendarState.field);
      var selectedDate = calendarState.field === 'checkin' ? fromIso(checkinEl && checkinEl.value) : fromIso(checkoutEl && checkoutEl.value);

      calendarMonthLabel.textContent = firstDay.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      if (calendarHelp) {
        calendarHelp.textContent = calendarState.field === 'checkin'
          ? 'Choose your check-in date'
          : 'Choose your check-out date (minimum 1 night stay)';
      }

      for (var empty = 0; empty < startWeekday; empty += 1) {
        var emptyCell = document.createElement('span');
        emptyCell.className = 'calendar-empty';
        calendarGrid.appendChild(emptyCell);
      }

      for (var day = 1; day <= daysInMonth; day += 1) {
        var date = new Date(viewYear, viewMonth, day);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'calendar-day';
        btn.textContent = String(day);
        btn.setAttribute('aria-label', date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));

        if (date < minDate) {
          btn.classList.add('disabled');
          btn.disabled = true;
        } else {
          btn.addEventListener('click', function (event) {
            var targetDate = new Date(viewYear, viewMonth, Number(event.currentTarget.textContent));
            var iso = toIso(targetDate);
            if (calendarState.field === 'checkin') checkinEl.value = iso;
            else checkoutEl.value = iso;
            updateDateBounds();
            updateDateDisplays();
            calc();
            closeCalendar();
          });
        }

        if (sameDay(date, today)) btn.classList.add('today');
        if (sameDay(date, selectedDate)) btn.classList.add('selected');
        calendarGrid.appendChild(btn);
      }
    };

    var openCalendarFor = function (field) {
      if (!calendarModal) return;
      calendarState.field = field;
      var selected = field === 'checkin' ? fromIso(checkinEl && checkinEl.value) : fromIso(checkoutEl && checkoutEl.value);
      var minDate = getCalendarMinDate(field);
      var basis = selected && selected >= minDate ? selected : minDate;
      calendarState.month = new Date(basis.getFullYear(), basis.getMonth(), 1);
      renderCalendar();
      calendarModal.hidden = false;
      document.body.classList.add('calendar-open');
      if (checkinDisplay) checkinDisplay.setAttribute('aria-expanded', field === 'checkin' ? 'true' : 'false');
      if (checkoutDisplay) checkoutDisplay.setAttribute('aria-expanded', field === 'checkout' ? 'true' : 'false');
    };

    var calc = function () {
      if (!checkinEl || !checkoutEl || !roomTypeEl) return;
      var room = roomTypeEl.value || 'maple';
      var guests = Math.max(1, Number(guestsEl && guestsEl.value ? guestsEl.value : 1));
      var d = parseDates();
      var checkin = d.checkin;
      var checkout = d.checkout;
      var nights = 0;
      var base = 0;

      if (checkin && checkout && checkout > checkin) {
        var cursor = new Date(checkin);
        while (cursor < checkout) {
          base += getNightRate(room, cursor);
          nights += 1;
          cursor.setDate(cursor.getDate() + 1);
        }
      }

      var addons = 0;
      addonsChecks.forEach(function (ck) {
        if (!ck.checked) return;
        var addon = ck.getAttribute('data-addon');
        var qtyEl = document.querySelector('.addon-qty[data-addon=\"' + addon + '\"]');
        var qty = Math.max(1, Number(qtyEl && qtyEl.value ? qtyEl.value : 1));
        if (addon === 'meals') {
          addons += addonRates[addon] * qty * guests * Math.max(1, nights);
        } else {
          addons += addonRates[addon] * qty;
        }
      });

      var total = base + addons;
      lastTotals = { room: room, guests: guests, nights: nights, base: base, addons: addons, total: total };

      if (sumRoom) sumRoom.textContent = roomLabels[room];
      if (sumNights) sumNights.textContent = String(nights);
      if (sumBase) sumBase.textContent = formatInr(base);
      if (sumAddons) sumAddons.textContent = formatInr(addons);
      if (sumTotal) sumTotal.textContent = formatInr(total);

      if (waQuoteBtn) {
        var fullName = [
          titleEl && titleEl.value ? titleEl.value : '',
          firstNameEl && firstNameEl.value ? firstNameEl.value : '',
          lastNameEl && lastNameEl.value ? lastNameEl.value : ''
        ].join(' ').trim();
        var quoteText =
          'Hello Omega Residency, please confirm this booking quote.\n' +
          'Guest: ' + (fullName || '-') + '\n' +
          'Mobile: ' + (phoneEl && phoneEl.value ? phoneEl.value : '-') + '\n' +
          'Email: ' + (emailEl && emailEl.value ? emailEl.value : '-') + '\n' +
          'Room: ' + roomLabels[room] + '\n' +
          'Check-in: ' + (checkinEl.value || '-') + '\n' +
          'Check-out: ' + (checkoutEl.value || '-') + '\n' +
          'Guests: ' + guests + '\n' +
          'Nights: ' + nights + '\n' +
          'Base: ' + formatInr(base) + '\n' +
          'Add-ons: ' + formatInr(addons) + '\n' +
          'Total: ' + formatInr(total) + '\n' +
          'Special Requests: ' + (specialReqEl && specialReqEl.value ? specialReqEl.value : '-');
        waQuoteBtn.href = 'https://wa.me/918509307438?text=' + encodeURIComponent(quoteText);
      }

      updateDateDisplays();
      updateConfirmation();
    };

    var updateConfirmation = function () {
      if (confirmGuest) {
        var guest = [
          titleEl && titleEl.value ? titleEl.value : '',
          firstNameEl && firstNameEl.value ? firstNameEl.value : '',
          lastNameEl && lastNameEl.value ? lastNameEl.value : ''
        ].join(' ').trim();
        confirmGuest.textContent = guest || '-';
      }
      if (confirmRoom) confirmRoom.textContent = roomLabels[lastTotals.room];
      if (confirmDates) {
        var checkinLabel = checkinEl && checkinEl.value ? formatDateLabel(checkinEl.value) : '-';
        var checkoutLabel = checkoutEl && checkoutEl.value ? formatDateLabel(checkoutEl.value) : '-';
        confirmDates.textContent = checkinLabel + ' to ' + checkoutLabel;
      }
      if (confirmGuests) confirmGuests.textContent = String(lastTotals.guests);
      if (confirmAddons) confirmAddons.textContent = formatInr(lastTotals.addons);
      if (confirmTotal) confirmTotal.textContent = formatInr(lastTotals.total);
    };

    var syncAddonState = function () {
      addonsChecks.forEach(function (ck) {
        var addon = ck.getAttribute('data-addon');
        var qtyEl = document.querySelector('.addon-qty[data-addon=\"' + addon + '\"]');
        var wrap = ck.closest('.addon-item');
        if (!qtyEl) return;
        if (ck.checked) {
          qtyEl.disabled = false;
          if (Number(qtyEl.value) < 1) qtyEl.value = '1';
          if (wrap) wrap.classList.remove('addon-off');
        } else {
          qtyEl.disabled = true;
          qtyEl.value = '0';
          if (wrap) wrap.classList.add('addon-off');
        }
      });
    };

    var showStep = function (step) {
      currentStep = step;
      stageEls.forEach(function (el) {
        var n = Number(el.getAttribute('data-stage'));
        el.classList.toggle('active', n === step);
      });
      stepPills.forEach(function (pill) {
        var n = Number(pill.getAttribute('data-step'));
        pill.classList.remove('active', 'done', 'locked');
        if (n === step) pill.classList.add('active');
        else if (n <= maxUnlockedStep) pill.classList.add('done');
        else pill.classList.add('locked');
      });
      setHint('');
    };

    var validateStep1 = function () {
      if (!roomTypeEl || !roomTypeEl.value) { setHint('Select a room to continue.'); return false; }
      if (!checkinEl.value || !checkoutEl.value) { setHint('Select check-in and check-out dates.'); return false; }
      var d = parseDates();
      if (!d.checkin || !d.checkout || d.checkout <= d.checkin) { setHint('Check-out must be after check-in.'); return false; }
      if (Number(guestsEl.value || 0) < 1) { setHint('Guests must be at least 1.'); return false; }
      return true;
    };

    var validateStep2 = function () {
      if (!firstNameEl.value.trim()) { setHint('Enter first name.'); return false; }
      if (!lastNameEl.value.trim()) { setHint('Enter last name.'); return false; }
      if (!phoneEl.value.trim()) { setHint('Enter mobile number.'); return false; }
      if (phoneEl.value.replace(/\D/g, '').length < 8) { setHint('Enter a valid mobile number.'); return false; }
      if (!emailEl.value.trim() || !emailEl.checkValidity()) { setHint('Enter a valid email address.'); return false; }
      return true;
    };

    if (checkinEl && !checkinEl.value) checkinEl.value = toIso(today);
    if (checkoutEl && !checkoutEl.value) checkoutEl.value = toIso(tomorrow);
    updateDateBounds();
    updateDateDisplays();

    [checkinEl, checkoutEl, roomTypeEl, guestsEl, titleEl, firstNameEl, lastNameEl, emailEl, phoneEl, specialReqEl].forEach(function (el) {
      if (el) el.addEventListener('input', calc);
      if (el) el.addEventListener('change', calc);
    });

    if (checkinDisplay) {
      checkinDisplay.addEventListener('click', function () {
        openCalendarFor('checkin');
      });
    }
    if (checkoutDisplay) {
      checkoutDisplay.addEventListener('click', function () {
        openCalendarFor('checkout');
      });
    }
    if (calendarPrev) {
      calendarPrev.addEventListener('click', function () {
        calendarState.month = new Date(calendarState.month.getFullYear(), calendarState.month.getMonth() - 1, 1);
        renderCalendar();
      });
    }
    if (calendarNext) {
      calendarNext.addEventListener('click', function () {
        calendarState.month = new Date(calendarState.month.getFullYear(), calendarState.month.getMonth() + 1, 1);
        renderCalendar();
      });
    }
    if (calendarCancel) {
      calendarCancel.addEventListener('click', closeCalendar);
    }
    if (calendarModal) {
      calendarModal.querySelectorAll('[data-calendar-close]').forEach(function (el) {
        el.addEventListener('click', closeCalendar);
      });
    }
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && calendarModal && !calendarModal.hidden) {
        closeCalendar();
      }
    });

    addonsChecks.forEach(function (el) {
      el.addEventListener('change', function () {
        syncAddonState();
        calc();
      });
    });
    addonsQty.forEach(function (el) { el.addEventListener('input', calc); });

    roomPickBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var room = btn.getAttribute('data-room');
        if (!roomTypeEl || !room) return;
        roomTypeEl.value = room;
        maxUnlockedStep = 1;
        showStep(1);
        calc();
      });
    });

    stepPills.forEach(function (pill) {
      pill.addEventListener('click', function () {
        var target = Number(pill.getAttribute('data-step'));
        if (target <= maxUnlockedStep) showStep(target);
      });
    });

    if (toStep2Btn) {
      toStep2Btn.addEventListener('click', function () {
        if (!validateStep1()) return;
        maxUnlockedStep = Math.max(maxUnlockedStep, 2);
        showStep(2);
      });
    }
    if (toStep3Btn) {
      toStep3Btn.addEventListener('click', function () {
        if (!validateStep2()) return;
        maxUnlockedStep = Math.max(maxUnlockedStep, 3);
        calc();
        updateConfirmation();
        showStep(3);
      });
    }
    if (backToStep1Btn) backToStep1Btn.addEventListener('click', function () { showStep(1); });
    if (backToStep2Btn) backToStep2Btn.addEventListener('click', function () { showStep(2); });

    syncAddonState();
    calc();
    showStep(1);
  }
})();
