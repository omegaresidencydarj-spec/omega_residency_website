(function () {
  var BOOKING_STORAGE_KEY = 'omega_booking_draft_v1';

  var roomLabels = {
    maple: 'Maple Deluxe',
    olive: 'Olive Suite',
    pine: 'Pine Suite'
  };

  var planLabels = {
    ep: 'EP (Room only)',
    cp: 'CP (Breakfast included)',
    map: 'MAP (Breakfast + lunch/dinner)'
  };

  var planMultipliers = {
    ep: 1,
    cp: 1.05,
    map: 1.18
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

  var addonLabels = {
    extra_bed: 'Extra Bed',
    heater: 'Heater',
    hot_bag: 'Electric Hot Water Bag',
    bed_blanket: 'Electric Bed Blanket',
    combo: 'Heating Combo',
    meals: 'Meals'
  };

  var includedGuests = 2;
  var extraGuestRates = { maple: 600, olive: 900, pine: 900 };

  var seasonal = [
    { name: 'Late Winter', from: '01-03', to: '03-31', rates: { maple: 1800, olive: 3000, pine: 3000 } },
    { name: 'Spring Peak', from: '04-01', to: '04-20', rates: { maple: 1950, olive: 3450, pine: 3450 } },
    { name: 'Summer Peak', from: '04-21', to: '06-10', rates: { maple: 4100, olive: 7100, pine: 7100 } },
    { name: 'Monsoon', from: '06-10', to: '09-25', rates: { maple: 1900, olive: 3300, pine: 3300 } },
    { name: 'Autumn Peak', from: '09-25', to: '11-01', rates: { maple: 4100, olive: 7200, pine: 7200 } },
    { name: 'Early Winter', from: '11-01', to: '12-20', rates: { maple: 1950, olive: 3450, pine: 3450 } },
    { name: 'Year-End Peak', from: '12-20', to: '01-02', rates: { maple: 4100, olive: 7100, pine: 7100 } }
  ];

  var menuBtn = document.getElementById('menuBtn');
  var navLinks = document.getElementById('navLinks');
  var yearEls = document.querySelectorAll('.year');
  var page = document.body.getAttribute('data-page');

  yearEls.forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  if (page) {
    document.querySelectorAll('.nav-links a[data-page]').forEach(function (a) {
      if (a.getAttribute('data-page') === page) a.classList.add('active');
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

  var formatInr = function (v) { return '₹' + Math.round(Number(v) || 0).toLocaleString('en-IN'); };
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

  var clampGuests = function (v) {
    var n = Math.floor(Number(v) || 0);
    if (n < 1) return 1;
    if (n > 12) return 12;
    return n;
  };

  var toKey = function (d) {
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return m + '-' + day;
  };

  var getPlanKey = function (plan) {
    return planLabels[plan] ? plan : 'ep';
  };

  var getPlanLabel = function (plan) {
    return planLabels[getPlanKey(plan)];
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

  var formatDateLabel = function (iso) {
    var d = fromIso(iso);
    if (!d) return '-';
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  var getDefaultState = function () {
    var today = startOfDay(new Date());
    var tomorrow = addDays(today, 1);
    return {
      room: 'maple',
      plan: 'ep',
      checkin: toIso(today),
      checkout: toIso(tomorrow),
      guests: 2,
      guestDetails: {
        title: 'Mr',
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        specialRequest: ''
      },
      addons: {
        extra_bed: 0,
        heater: 0,
        hot_bag: 0,
        bed_blanket: 0,
        combo: 0,
        meals: 0
      }
    };
  };

  var sanitizeState = function (raw) {
    var defaults = getDefaultState();
    var state = raw && typeof raw === 'object' ? raw : {};
    var room = roomLabels[state.room] ? state.room : defaults.room;
    var plan = getPlanKey(state.plan);

    var checkinDate = fromIso(state.checkin) || fromIso(defaults.checkin);
    var checkoutDate = fromIso(state.checkout) || addDays(checkinDate, 1);
    if (checkoutDate <= checkinDate) checkoutDate = addDays(checkinDate, 1);

    var guestDetails = state.guestDetails && typeof state.guestDetails === 'object' ? state.guestDetails : {};
    var addons = state.addons && typeof state.addons === 'object' ? state.addons : {};

    return {
      room: room,
      plan: plan,
      checkin: toIso(checkinDate),
      checkout: toIso(checkoutDate),
      guests: clampGuests(state.guests),
      guestDetails: {
        title: typeof guestDetails.title === 'string' && guestDetails.title ? guestDetails.title : defaults.guestDetails.title,
        firstName: typeof guestDetails.firstName === 'string' ? guestDetails.firstName : '',
        lastName: typeof guestDetails.lastName === 'string' ? guestDetails.lastName : '',
        phone: typeof guestDetails.phone === 'string' ? guestDetails.phone : '',
        email: typeof guestDetails.email === 'string' ? guestDetails.email : '',
        specialRequest: typeof guestDetails.specialRequest === 'string' ? guestDetails.specialRequest : ''
      },
      addons: {
        extra_bed: Math.max(0, Number(addons.extra_bed) || 0),
        heater: Math.max(0, Number(addons.heater) || 0),
        hot_bag: Math.max(0, Number(addons.hot_bag) || 0),
        bed_blanket: Math.max(0, Number(addons.bed_blanket) || 0),
        combo: Math.max(0, Number(addons.combo) || 0),
        meals: plan === 'ep' ? Math.max(0, Number(addons.meals) || 0) : 0
      }
    };
  };

  var loadBookingState = function () {
    var defaults = getDefaultState();
    try {
      var raw = window.sessionStorage.getItem(BOOKING_STORAGE_KEY);
      if (!raw) return defaults;
      return sanitizeState(JSON.parse(raw));
    } catch (err) {
      return defaults;
    }
  };

  var saveBookingState = function (state) {
    try {
      window.sessionStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(sanitizeState(state)));
    } catch (err) {
      // Ignore storage errors.
    }
  };

  var getStayBase = function (room, checkinIso, checkoutIso, guests) {
    var checkin = fromIso(checkinIso);
    var checkout = fromIso(checkoutIso);
    if (!checkin || !checkout || checkout <= checkin) {
      return { nights: 0, base: 0 };
    }

    var nights = 0;
    var base = 0;
    var cursor = new Date(checkin);

    while (cursor < checkout) {
      base += getNightRate(room, cursor);
      nights += 1;
      cursor.setDate(cursor.getDate() + 1);
    }

    var extraGuests = Math.max(0, clampGuests(guests) - includedGuests);
    if (extraGuests > 0 && nights > 0) {
      base += extraGuests * (extraGuestRates[room] || 0) * nights;
    }

    return { nights: nights, base: base };
  };

  var getAddonsTotal = function (addons, guests, nights) {
    var total = 0;
    var guestCount = clampGuests(guests);
    var nightCount = Math.max(1, nights);

    Object.keys(addonRates).forEach(function (addon) {
      var qty = Math.max(0, Number(addons[addon]) || 0);
      if (qty < 1) return;
      if (addon === 'meals') total += addonRates[addon] * qty * guestCount * nightCount;
      else total += addonRates[addon] * qty;
    });

    return total;
  };

  var getBookingTotals = function (state) {
    var stay = getStayBase(state.room, state.checkin, state.checkout, state.guests);
    var plan = getPlanKey(state.plan);
    var planMultiplier = planMultipliers[plan] || 1;
    var planAdjustedBase = Math.round(stay.base * planMultiplier);
    var addonsTotal = getAddonsTotal(state.addons, state.guests, stay.nights);
    return {
      plan: plan,
      nights: stay.nights,
      base: planAdjustedBase,
      addons: addonsTotal,
      total: planAdjustedBase + addonsTotal
    };
  };

  var updateSummaryPanel = function (state, totals) {
    var sumRoom = document.getElementById('sumRoom');
    var sumPlan = document.getElementById('sumPlan');
    var sumNights = document.getElementById('sumNights');
    var sumBase = document.getElementById('sumBase');
    var sumAddons = document.getElementById('sumAddons');
    var sumTotal = document.getElementById('sumTotal');

    if (sumRoom) sumRoom.textContent = roomLabels[state.room] || roomLabels.maple;
    if (sumPlan) sumPlan.textContent = getPlanLabel(state.plan);
    if (sumNights) sumNights.textContent = String(totals.nights);
    if (sumBase) sumBase.textContent = formatInr(totals.base);
    if (sumAddons) sumAddons.textContent = formatInr(totals.addons);
    if (sumTotal) sumTotal.textContent = formatInr(totals.total);
  };

  var getAddonBreakdown = function (addons) {
    var items = [];
    Object.keys(addonRates).forEach(function (addon) {
      var qty = Math.max(0, Number(addons[addon]) || 0);
      if (qty > 0) items.push(addonLabels[addon] + ' x' + qty);
    });
    return items.length ? items.join(', ') : 'None';
  };

  var initRoomsPage = function () {
    var checkinEl = document.getElementById('checkinDate');
    var checkoutEl = document.getElementById('checkoutDate');
    var guestsEl = document.getElementById('guestsCount');
    var checkinDisplay = document.getElementById('checkinDisplay');
    var checkoutDisplay = document.getElementById('checkoutDisplay');
    var roomPriceValueEls = document.querySelectorAll('[data-room-price]');
    var roomPickBtns = document.querySelectorAll('.book-room-btn');

    var calendarModal = document.getElementById('calendarModal');
    var calendarGrid = document.getElementById('calendarGrid');
    var calendarMonthLabel = document.getElementById('calendarMonthLabel');
    var calendarHelp = document.getElementById('calendarHelp');
    var calendarPrev = document.getElementById('calendarPrev');
    var calendarNext = document.getElementById('calendarNext');
    var calendarCancel = document.getElementById('calendarCancel');

    if (!checkinEl || !checkoutEl || !guestsEl || !checkinDisplay || !checkoutDisplay) return;

    var state = loadBookingState();
    checkinEl.value = state.checkin;
    checkoutEl.value = state.checkout;
    guestsEl.value = String(state.guests);

    var calendarState = { field: 'checkin', month: new Date() };

    var syncPlannerState = function () {
      var checkinDate = fromIso(checkinEl.value) || startOfDay(new Date());
      var checkoutDate = fromIso(checkoutEl.value) || addDays(checkinDate, 1);
      if (checkoutDate <= checkinDate) checkoutDate = addDays(checkinDate, 1);

      state.checkin = toIso(checkinDate);
      state.checkout = toIso(checkoutDate);
      state.guests = clampGuests(guestsEl.value);

      checkinEl.value = state.checkin;
      checkoutEl.value = state.checkout;
      guestsEl.value = String(state.guests);
    };

    var updateDateDisplays = function () {
      var checkinLabel = checkinDisplay.querySelector('.calendar-trigger-label');
      var checkoutLabel = checkoutDisplay.querySelector('.calendar-trigger-label');
      if (checkinLabel) checkinLabel.textContent = formatDateLabel(state.checkin);
      if (checkoutLabel) checkoutLabel.textContent = formatDateLabel(state.checkout);
      checkinDisplay.classList.add('has-value');
      checkoutDisplay.classList.add('has-value');
    };

    var updateRoomTariffs = function () {
      roomPriceValueEls.forEach(function (valueEl) {
        var room = valueEl.getAttribute('data-room-price');
        if (!room) return;

        var labelEl = document.querySelector('[data-room-price-label="' + room + '"]');
        var noteEl = document.querySelector('[data-room-price-note="' + room + '"]');
        var stay = getStayBase(room, state.checkin, state.checkout, state.guests);

        if (stay.nights < 1) {
          valueEl.textContent = formatInr(tariffFallback[room] || 0);
          if (labelEl) labelEl.textContent = 'From (EP)';
          if (noteEl) noteEl.textContent = '1 night · 2 guests';
          return;
        }

        valueEl.textContent = formatInr(stay.base);
        if (labelEl) labelEl.textContent = 'Selected stay (EP)';
        if (noteEl) {
          var nightText = stay.nights === 1 ? '1 night' : String(stay.nights) + ' nights';
          var guestText = state.guests === 1 ? '1 guest' : String(state.guests) + ' guests';
          noteEl.textContent = nightText + ' · ' + guestText;
        }
      });
    };

    var renderRooms = function () {
      syncPlannerState();
      updateDateDisplays();
      updateRoomTariffs();
      updateSummaryPanel(state, getBookingTotals(state));
      saveBookingState(state);
    };

    var getCalendarMinDate = function (field) {
      if (field === 'checkout') {
        var ci = fromIso(checkinEl.value) || startOfDay(new Date());
        return addDays(ci, 1);
      }
      return startOfDay(new Date());
    };

    var closeCalendar = function () {
      if (!calendarModal) return;
      calendarModal.hidden = true;
      document.body.classList.remove('calendar-open');
      checkinDisplay.setAttribute('aria-expanded', 'false');
      checkoutDisplay.setAttribute('aria-expanded', 'false');
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
      var selectedDate = calendarState.field === 'checkin' ? fromIso(checkinEl.value) : fromIso(checkoutEl.value);

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
            var selectedDay = Number(event.currentTarget.textContent);
            var chosen = new Date(viewYear, viewMonth, selectedDay);
            var iso = toIso(chosen);
            if (calendarState.field === 'checkin') checkinEl.value = iso;
            else checkoutEl.value = iso;
            renderRooms();
            closeCalendar();
          });
        }

        if (date.getTime() === startOfDay(new Date()).getTime()) btn.classList.add('today');
        if (selectedDate && date.getFullYear() === selectedDate.getFullYear() && date.getMonth() === selectedDate.getMonth() && date.getDate() === selectedDate.getDate()) {
          btn.classList.add('selected');
        }

        calendarGrid.appendChild(btn);
      }
    };

    var openCalendarFor = function (field) {
      if (!calendarModal) return;
      calendarState.field = field;
      var selected = field === 'checkin' ? fromIso(checkinEl.value) : fromIso(checkoutEl.value);
      var minDate = getCalendarMinDate(field);
      var basis = selected && selected >= minDate ? selected : minDate;
      calendarState.month = new Date(basis.getFullYear(), basis.getMonth(), 1);
      renderCalendar();
      calendarModal.hidden = false;
      document.body.classList.add('calendar-open');
      checkinDisplay.setAttribute('aria-expanded', field === 'checkin' ? 'true' : 'false');
      checkoutDisplay.setAttribute('aria-expanded', field === 'checkout' ? 'true' : 'false');
    };

    guestsEl.addEventListener('input', renderRooms);
    guestsEl.addEventListener('change', renderRooms);

    checkinDisplay.addEventListener('click', function () { openCalendarFor('checkin'); });
    checkoutDisplay.addEventListener('click', function () { openCalendarFor('checkout'); });

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

    if (calendarCancel) calendarCancel.addEventListener('click', closeCalendar);

    if (calendarModal) {
      calendarModal.querySelectorAll('[data-calendar-close]').forEach(function (el) {
        el.addEventListener('click', closeCalendar);
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && calendarModal && !calendarModal.hidden) closeCalendar();
    });

    roomPickBtns.forEach(function (btn) {
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        renderRooms();
        var room = btn.getAttribute('data-room');
        if (roomLabels[room]) state.room = room;
        state.plan = 'ep';
        saveBookingState(state);
        window.location.href = 'booking.html';
      });
    });

    renderRooms();
  };

  var initBookingPage = function () {
    var form = document.getElementById('guestDetailsForm');
    if (!form) return;

    var state = loadBookingState();

    var titleEl = document.getElementById('titleSelect');
    var firstNameEl = document.getElementById('firstName');
    var lastNameEl = document.getElementById('lastName');
    var phoneEl = document.getElementById('guestPhone');
    var emailEl = document.getElementById('guestEmail');
    var specialReqEl = document.getElementById('specialRequest');
    var planEl = document.getElementById('mealPlanSelect');
    var hintEl = document.getElementById('bookingHint');
    var backBtn = document.getElementById('backToRoomsBtn');

    var bookingRoomEl = document.getElementById('bookingRoom');
    var bookingPlanEl = document.getElementById('bookingPlan');
    var bookingDatesEl = document.getElementById('bookingDates');
    var bookingGuestsEl = document.getElementById('bookingGuests');

    var addonsChecks = document.querySelectorAll('.addon-check');
    var addonsQty = document.querySelectorAll('.addon-qty');

    var setHint = function (msg) {
      if (hintEl) hintEl.textContent = msg || '';
    };

    if (titleEl) titleEl.value = state.guestDetails.title || 'Mr';
    if (firstNameEl) firstNameEl.value = state.guestDetails.firstName || '';
    if (lastNameEl) lastNameEl.value = state.guestDetails.lastName || '';
    if (phoneEl) phoneEl.value = state.guestDetails.phone || '';
    if (emailEl) emailEl.value = state.guestDetails.email || '';
    if (specialReqEl) specialReqEl.value = state.guestDetails.specialRequest || '';
    if (planEl) planEl.value = getPlanKey(state.plan);

    var applyAddonsToUi = function () {
      var mealsAllowed = getPlanKey(state.plan) === 'ep';

      addonsChecks.forEach(function (ck) {
        var addon = ck.getAttribute('data-addon');
        var qtyEl = document.querySelector('.addon-qty[data-addon="' + addon + '"]');
        var qty = Math.max(0, Number(state.addons[addon]) || 0);
        var wrap = ck.closest('.addon-item');

        if (addon === 'meals' && !mealsAllowed) {
          state.addons.meals = 0;
          ck.checked = false;
          ck.disabled = true;
          if (qtyEl) {
            qtyEl.disabled = true;
            qtyEl.value = '0';
          }
          if (wrap) {
            wrap.classList.add('addon-off');
            wrap.classList.add('addon-hidden');
          }
          return;
        }

        if (addon === 'meals') {
          ck.disabled = false;
          if (wrap) wrap.classList.remove('addon-hidden');
        }

        ck.checked = qty > 0;

        if (!qtyEl) return;
        if (qty > 0) {
          qtyEl.disabled = false;
          qtyEl.value = String(qty);
          if (wrap) wrap.classList.remove('addon-off');
        } else {
          qtyEl.disabled = true;
          qtyEl.value = '0';
          if (wrap) wrap.classList.add('addon-off');
        }
      });
    };

    var syncStateFromForm = function () {
      state.plan = getPlanKey(planEl ? planEl.value : state.plan);

      state.guestDetails = {
        title: titleEl ? titleEl.value : 'Mr',
        firstName: firstNameEl ? firstNameEl.value : '',
        lastName: lastNameEl ? lastNameEl.value : '',
        phone: phoneEl ? phoneEl.value : '',
        email: emailEl ? emailEl.value : '',
        specialRequest: specialReqEl ? specialReqEl.value : ''
      };

      addonsChecks.forEach(function (ck) {
        var addon = ck.getAttribute('data-addon');
        var qtyEl = document.querySelector('.addon-qty[data-addon="' + addon + '"]');
        if (!addon) return;
        if (addon === 'meals' && state.plan !== 'ep') {
          state.addons.meals = 0;
          if (qtyEl) qtyEl.value = '0';
          return;
        }
        if (!ck.checked) {
          state.addons[addon] = 0;
          if (qtyEl) qtyEl.value = '0';
          return;
        }
        var qty = Math.max(1, Number(qtyEl && qtyEl.value ? qtyEl.value : 1));
        state.addons[addon] = qty;
        if (qtyEl) qtyEl.value = String(qty);
      });
    };

    var renderBooking = function () {
      syncStateFromForm();
      applyAddonsToUi();
      var totals = getBookingTotals(state);

      if (bookingRoomEl) bookingRoomEl.textContent = roomLabels[state.room] || roomLabels.maple;
      if (bookingPlanEl) bookingPlanEl.textContent = getPlanLabel(state.plan);
      if (bookingDatesEl) bookingDatesEl.textContent = formatDateLabel(state.checkin) + ' to ' + formatDateLabel(state.checkout);
      if (bookingGuestsEl) bookingGuestsEl.textContent = String(state.guests);

      updateSummaryPanel(state, totals);
      saveBookingState(state);
    };

    addonsChecks.forEach(function (ck) {
      ck.addEventListener('change', function () {
        var addon = ck.getAttribute('data-addon');
        var qtyEl = document.querySelector('.addon-qty[data-addon="' + addon + '"]');
        var wrap = ck.closest('.addon-item');

        if (ck.checked) {
          if (qtyEl) {
            qtyEl.disabled = false;
            if (Number(qtyEl.value) < 1) qtyEl.value = '1';
          }
          if (wrap) wrap.classList.remove('addon-off');
        } else {
          if (qtyEl) {
            qtyEl.disabled = true;
            qtyEl.value = '0';
          }
          if (wrap) wrap.classList.add('addon-off');
        }

        renderBooking();
      });
    });

    addonsQty.forEach(function (qtyEl) {
      qtyEl.addEventListener('input', renderBooking);
      qtyEl.addEventListener('change', renderBooking);
    });

    [planEl, titleEl, firstNameEl, lastNameEl, phoneEl, emailEl, specialReqEl].forEach(function (el) {
      if (!el) return;
      el.addEventListener('input', renderBooking);
      el.addEventListener('change', renderBooking);
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      syncStateFromForm();

      if (!state.guestDetails.firstName.trim()) { setHint('Enter first name.'); return; }
      if (!state.guestDetails.lastName.trim()) { setHint('Enter last name.'); return; }
      if (!state.guestDetails.phone.trim()) { setHint('Enter mobile number.'); return; }
      if (state.guestDetails.phone.replace(/\D/g, '').length < 8) { setHint('Enter a valid mobile number.'); return; }
      if (!emailEl || !emailEl.checkValidity()) { setHint('Enter a valid email address.'); return; }

      setHint('');
      saveBookingState(state);
      window.location.href = 'payment.html';
    });

    if (backBtn) {
      backBtn.addEventListener('click', function () {
        syncStateFromForm();
        saveBookingState(state);
        window.location.href = 'rooms.html#stay-planner';
      });
    }

    applyAddonsToUi();
    renderBooking();
  };

  var initPaymentPage = function () {
    var payRoomEl = document.getElementById('payRoom');
    if (!payRoomEl) return;

    var state = loadBookingState();
    var totals = getBookingTotals(state);

    var payGuestEl = document.getElementById('payGuest');
    var payDatesEl = document.getElementById('payDates');
    var payGuestsEl = document.getElementById('payGuests');
    var payPlanEl = document.getElementById('payPlan');
    var payAddonsEl = document.getElementById('payAddons');
    var payTotalEl = document.getElementById('payTotal');
    var waBtn = document.getElementById('paymentWhatsAppBtn');

    var fullName = [
      state.guestDetails.title || '',
      state.guestDetails.firstName || '',
      state.guestDetails.lastName || ''
    ].join(' ').trim();

    if (payGuestEl) payGuestEl.textContent = fullName || '-';
    payRoomEl.textContent = roomLabels[state.room] || roomLabels.maple;
    if (payDatesEl) payDatesEl.textContent = formatDateLabel(state.checkin) + ' to ' + formatDateLabel(state.checkout);
    if (payGuestsEl) payGuestsEl.textContent = String(state.guests);
    if (payPlanEl) payPlanEl.textContent = getPlanLabel(state.plan);
    if (payAddonsEl) payAddonsEl.textContent = formatInr(totals.addons);
    if (payTotalEl) payTotalEl.textContent = formatInr(totals.total);

    updateSummaryPanel(state, totals);

    if (waBtn) {
      var message =
        'Hello Omega Residency, please confirm this booking quote.\n' +
        'Guest: ' + (fullName || '-') + '\n' +
        'Mobile: ' + (state.guestDetails.phone || '-') + '\n' +
        'Email: ' + (state.guestDetails.email || '-') + '\n' +
        'Room: ' + (roomLabels[state.room] || roomLabels.maple) + '\n' +
        'Meal Plan: ' + getPlanLabel(state.plan) + '\n' +
        'Check-in: ' + (state.checkin || '-') + '\n' +
        'Check-out: ' + (state.checkout || '-') + '\n' +
        'Guests: ' + String(state.guests) + '\n' +
        'Nights: ' + String(totals.nights) + '\n' +
        'Base: ' + formatInr(totals.base) + '\n' +
        'Add-ons: ' + formatInr(totals.addons) + ' (' + getAddonBreakdown(state.addons) + ')\n' +
        'Total: ' + formatInr(totals.total) + '\n' +
        'Special Requests: ' + (state.guestDetails.specialRequest || '-');

      waBtn.href = 'https://wa.me/918509307438?text=' + encodeURIComponent(message);
    }

    saveBookingState(state);
  };

  if (page === 'rooms') initRoomsPage();
  if (page === 'booking') initBookingPage();
  if (page === 'payment') initPaymentPage();
})();
