import { Injectable, EventEmitter, Output } from '@angular/core';
import { Router, RouterLinkActive, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { FeatureCollection, GeoJson } from '../map';
import { LocationService } from './location.service';
import { DateService } from './date.service';
import { ViewState } from '../view-enum';
import * as moment from 'moment';
import { Moment } from 'moment';

// Calendar Day Interface
export interface CalendarDay {
  date: Date;                         // full date
  month: number;                      // month number
  year: number;                       // year number
  dayOfMonth: number;                 // day of month (number)
  dayOfWeek: string;                  // day of week (string)
  events: GeoJson[];                  // events on day
  isToday: boolean;                   // is day today
  isSelected: boolean;                // is day currently selected
  inCurrentMonth: boolean;            // is day in the current month
}

// how many hours after UPCOMING_START does upcoming end? (inclusive)
const UPCOMING_LEN = 4;
// what time does morning start? (inclusive)
const MORNING_START = 240;
// what time does morning end? (exclusive)
const MORNING_END = 719;
// what time does afternoon start? (inclusive)
const AFTERNOON_START = 720;
// what time does afternoon end? (exclusive)
const AFTERNOON_END = 1019;
// what time does evening start? (inclusive)
const EVENING_START = 1020;
// what time does evening end? (exclusive)
const EVENING_END = 239;

@Injectable()
export class EventService {

  // USEFUL URLS
  private eventsUrl = "api/events";
  private allEvents;
  private categoriesUrl = "api/events/categories";
  private categs;

  // VIEW VARIABLES
  private _currentView;             // ('three-day', month', 'week', 'map')
  private _lastView;                // ('three-day', month', 'week', 'map')

  // DATE VARIABLES
  private _visibleDays;              // currently displayed days in CalendarDay format
  private _selectedDate;             // currently selected day in Date format

  // EVENT STORAGE VARIABLES
  private _monthEvents;               // events for current month view
  private _filteredMonthEvents;       // events for current month view (filters applied)
  private _weekEvents;                // events for current week view
  private _filteredWeekEvents;        // events for current week view (filters applied)
  private _threeDayEvents;            // events for current three-day view
  private _filteredThreeDayEvents;    // events for current three-day view (filters applied)
  private _dayEvents;                 // events for current single day map view
  private _filteredDayEvents;         // events for current single day map view (filters applied)

  // SOLO EVENT VARIABLES
  private _hoveredEvent;              // current hovered event
  private _clickedEvent;              // current clicked event
  private _sidebarEvent;              // current sidebar event (event expanded in sidebar)

  // FILTER VARIABLES
  private _filterCount;               // number of filters being applied
  private _categHash;                 // maps event categories to selection status
  private _locFilter;                 // location string being applied as filter
  private _locations;                 // list of all possible locations
  private _dateFilter;                // range of dates being applied as filter
  private _timeFilter;                // range of times being applied as filter

  // SOURCES
  private currentViewSource: Subject <ViewState>;
  private lastViewSource: Subject <ViewState>;
  private visibleDaysSource: Subject <any>;
  private selectedDateSource: BehaviorSubject <Date>;
  private monthEventsSource: BehaviorSubject <FeatureCollection>;
  private filteredMonthEventsSource: BehaviorSubject <FeatureCollection>;
  private weekEventsSource: BehaviorSubject <FeatureCollection>;
  private filteredWeekEventsSource: BehaviorSubject <FeatureCollection>;
  private threeDayEventsSource: BehaviorSubject <FeatureCollection>;
  private filteredThreeDayEventsSource: BehaviorSubject <FeatureCollection>;
  private dayEventsSource: BehaviorSubject <FeatureCollection>;
  private filteredDayEventsSource: BehaviorSubject <FeatureCollection>;
  private hoveredEventSource: Subject <GeoJson>;
  private clickedEventSource: Subject <GeoJson>;
  private sidebarEventSource: Subject <GeoJson>;
  private filterCountSource: BehaviorSubject<number>;
  private categHashSource: BehaviorSubject <any>;
  private locFilterSource: BehaviorSubject <any>;
  private locationsSource: BehaviorSubject <any>;
  private dateFilterSource: BehaviorSubject <any>;
  private timeFilterSource: BehaviorSubject <any>;

  // OBSERVABLES
  currentView$; lastView$;
  visibleDays$; selectedDate$;
  monthEvents$; filteredMonthEvents$;
  weekEvents$; filteredWeekEvents$;
  threeDayEvents$; filteredThreeDayEvents$;
  dayEvents$; filteredDayEvents$;
  hoveredEvent$; clickedEvent$; sidebarEvent$;
  filterCount$; categHash$; locFilter$; locations$; dateFilter$; timeFilter$;

  // Constructor
  constructor(private router: Router, private http: HttpClient, private _dateService: DateService, private _locationService: LocationService) {

    // For each of the following variables:
    // observable string source, observable string stream, self-subscribed local value

    // currentView
    this.currentViewSource = new Subject <ViewState> ();
    this.currentView$ = this.currentViewSource.asObservable();
    this.currentView$.subscribe(view => this._currentView = view);

    // lastView
    this.lastViewSource = new Subject <ViewState> ();
    this.lastView$ = this.lastViewSource.asObservable();
    this.lastView$.subscribe(view => this._lastView = view);

    // visibleDays
    this.visibleDaysSource = new Subject <CalendarDay[]> ();
    this.visibleDays$ = this.visibleDaysSource.asObservable();
    this.visibleDays$.subscribe(days => this._visibleDays = days);

    // selectedDate
    this.selectedDateSource = new BehaviorSubject <Date> (new Date());
    this.selectedDate$ = this.selectedDateSource.asObservable();
    this.selectedDate$.subscribe(date => this._selectedDate = date);

    // filteredMonthEvents
    this.filteredMonthEventsSource = new BehaviorSubject <FeatureCollection> (new FeatureCollection([]));
    this.filteredMonthEvents$  = this.filteredMonthEventsSource.asObservable();
    this.filteredMonthEvents$.subscribe(filteredMonthEvents => this._filteredMonthEvents = filteredMonthEvents);

    // monthEvents
    this.monthEventsSource = new BehaviorSubject <FeatureCollection> (new FeatureCollection([]));
    this.monthEvents$  = this.monthEventsSource.asObservable();
    this.monthEvents$.subscribe(monthEvents => {
      this._monthEvents = monthEvents;
      this.filteredMonthEventsSource.next(monthEvents);
    });

    // filteredWeekEvents
    this.filteredWeekEventsSource = new BehaviorSubject <FeatureCollection> (new FeatureCollection([]));
    this.filteredWeekEvents$ = this.filteredWeekEventsSource.asObservable();
    this.filteredWeekEvents$.subscribe(filteredWeekEvents => this._filteredWeekEvents = filteredWeekEvents);

    // weekEvents
    this.weekEventsSource = new BehaviorSubject <FeatureCollection> (new FeatureCollection([]));
    this.weekEvents$  = this.weekEventsSource.asObservable();
    this.weekEvents$.subscribe(weekEvents => {
      this._weekEvents = weekEvents;
      this.filteredWeekEventsSource.next(weekEvents);
    });

    // filteredThreeDayEvents
    this.filteredThreeDayEventsSource = new BehaviorSubject <FeatureCollection> (new FeatureCollection([]));
    this.filteredThreeDayEvents$ = this.filteredThreeDayEventsSource.asObservable();
    this.filteredThreeDayEvents$.subscribe(filteredThreeDayEvents => this._filteredThreeDayEvents = filteredThreeDayEvents);

    // threeDayEvents
    this.threeDayEventsSource = new BehaviorSubject <FeatureCollection> (new FeatureCollection([]));
    this.threeDayEvents$ = this.threeDayEventsSource.asObservable();
    this.threeDayEvents$.subscribe(threeDayEvents => {
      this._threeDayEvents = threeDayEvents;
      this.filteredThreeDayEventsSource.next(threeDayEvents);
    });

    // filteredDayEvents
    this.filteredDayEventsSource = new BehaviorSubject <FeatureCollection> (new FeatureCollection([]));
    this.filteredDayEvents$ = this.filteredDayEventsSource.asObservable();
    this.filteredDayEvents$.subscribe(filteredDayEvents => this._filteredDayEvents = filteredDayEvents);

    // dayEvents
    this.dayEventsSource = new BehaviorSubject <FeatureCollection> (new FeatureCollection([]));
    this.dayEvents$ = this.dayEventsSource.asObservable();
    this.dayEvents$.subscribe(dayEvents => {
      this._dayEvents = dayEvents;
      this.filteredDayEventsSource.next(dayEvents);
    });

    // hoveredEvent
    this.hoveredEventSource = new Subject <GeoJson> ();
    this.hoveredEvent$ = this.hoveredEventSource.asObservable();
    this.hoveredEvent$.subscribe(hoveredEventInfo => this._hoveredEvent = hoveredEventInfo);

    // clickedEvent
    this.clickedEventSource = new Subject <GeoJson> ();
    this.clickedEvent$ = this.clickedEventSource.asObservable();
    this.clickedEvent$.subscribe(clickedEventInfo => this._clickedEvent = clickedEventInfo);

    // sidebarEvent
    this.sidebarEventSource = new Subject <GeoJson> ();
    this.sidebarEvent$ = this.sidebarEventSource.asObservable();
    this.sidebarEvent$.subscribe(sidebarEventInfo => this._sidebarEvent = sidebarEventInfo);

    // filterCount
    this.filterCountSource = new BehaviorSubject <number> (0);
    this.filterCount$ = this.filterCountSource.asObservable();
    this.filterCount$.subscribe(filterCount => { this._filterCount = filterCount; })

    // categHash
    this.categHashSource = new BehaviorSubject <any> ({});
    this.categHash$ = this.categHashSource.asObservable();
    this.categHash$.subscribe(categHash => { this._categHash = categHash; this.applyAllFilters(); });

    // locFilter
    this.locFilterSource = new BehaviorSubject <any> ({});
    this.locFilter$ = this.locFilterSource.asObservable();
    this.locFilter$.subscribe(locSearch => { this._locFilter = locSearch; this.applyAllFilters(); });

    // locations
    this.locationsSource = new BehaviorSubject <any> ([]);
    this.locations$ = this.locationsSource.asObservable();
    this.locations$.subscribe(locOptions => { this._locations = locOptions; });

    // dateFilter
    this.dateFilterSource = new BehaviorSubject <any> ({});
    this.dateFilter$ = this.dateFilterSource.asObservable();
    this.dateFilter$.subscribe(dateHash => { this._dateFilter = dateHash; this.applyAllFilters(); });

    // timeFilter
    this.timeFilterSource = new BehaviorSubject <any> ({});
    this.timeFilter$ = this.timeFilterSource.asObservable();
    this.timeFilter$.subscribe(timeHash => { this._timeFilter = timeHash; this.applyAllFilters(); });

    this._selectedDate = new Date();
    // Initialize variables
    this.http.get <FeatureCollection> (this.getEventsURL()).subscribe(allEvents => {
      this.allEvents = allEvents;
      this.initLocations();
      this.getCategories().subscribe(categs => {
        // initialize filters
        this.categs = categs;
        this.initCategories();
        this.resetFilters();
        // populate event containers
        this.updateEvents(new Date(),true,true,true);
        // set current date
        this.setSelectedDate(new Date());
        // initiailize view variables
        let view; if(this.isMapView()) { view = ViewState.map; }
        else if(this.isMonthView()) { view = ViewState.month; }
        else if(this.isWeekView()) { view = ViewState.week; }
        else if(this.isThreeDayView()) { view = ViewState.threeday; }
        this.setCurrentView(view);
        this.storeLastView(ViewState.month);
      });
    });
  }

  private initLocations() {
    let tempLocs = [];
    this.allEvents.features.forEach(el => {
      let loc = el.properties.place.name;
      if (!tempLocs.includes(loc))
        tempLocs.push(loc)
    });
    this._locations = tempLocs;
    this.locationsSource.next(this._locations);
  }

  // View Getters and Setters //

  isMapView() { return this.router.url.startsWith("/map") }
  isCalendarView() { return this.router.url.startsWith("/calendar") }
  isMonthView() { return this.router.url.startsWith("/calendar/month") }
  isWeekView() { return this.router.url.startsWith("/calendar/week") }
  isThreeDayView() { return this.router.url.startsWith("/calendar/three-day") }

  setCurrentView(view: ViewState) {
    this.currentViewSource.next(view);
  } getCurrentView() { return this._currentView; }

  storeLastView(view: ViewState){
    this.lastViewSource.next(view);
  } retrieveLastView(){ return this._lastView; }

  // Day Getters and Setters //

  setVisibleDays(visibleDays: CalendarDay[]){
    this.visibleDaysSource.next(visibleDays);
  } getVisibleDays(){ return this._visibleDays; }

  setSelectedDate(date: Date){
    this.selectedDateSource.next(date);
  } getSelectedDate() { return this._selectedDate; }

  // Event Collection Getters and Setters //

  getMonthEvents() { return this._monthEvents; }
  getFilteredMonthEvents() { return this._filteredMonthEvents; }

  getWeekEvents() { return this._weekEvents; }
  getFilteredWeekEvents() { return this._filteredWeekEvents; }

  getThreeDayEvents() { return this._threeDayEvents; }
  getFilteredThreeDayEvents() { return this._filteredThreeDayEvents; }

  getDayEvents() { return this._dayEvents; }
  getFilteredDayEvents() { return this._filteredDayEvents; }

  // Event Getters and Setters //

  updateHoveredEvent(event: GeoJson): void {
    this.hoveredEventSource.next(event);
  } getHoveredEvent() { return this._hoveredEvent; }

  updateClickedEvent(event: GeoJson): void {
    this.clickedEventSource.next(event);
  } getClickedEvent(){ return this._clickedEvent; }

  updateSidebarEvent(event: GeoJson): void {
    this.sidebarEventSource.next(event);
  } getSidebarEvent(){ return this._sidebarEvent; }

  resetEventSelection() {
    this.updateHoveredEvent(null);
    this.updateClickedEvent(null);
    this.updateSidebarEvent(null);
    this.router.navigate(['', {outlets: {sidebar: ['list']}}]);
  }

  // UPDATE DATE SPAN - Call whenever the visible days change!! //

  // Change the span of visible dates (provide post-update date and view)
  changeDateSpan(newDate: Date, newView : ViewState) {
    // if date changed
    if(!(moment(newDate).isSame(moment(this._selectedDate), 'day'))) {
      // determine whether new date is in the same view spans as current date
      let sameMonth = this._dateService.inSameMonth(newDate,this._selectedDate);
      let sameWeek = this._dateService.inSameWeek(newDate,this._selectedDate);
      let sameThreeDay = this._dateService.inSameThreeDay(newDate,this._selectedDate);
      // update the event collections (only if new event collections are needed)
      this.updateEvents(newDate, !sameMonth, !sameWeek, !sameThreeDay);
      // update current date
      this.setSelectedDate(newDate);
      // reset date span filter
      if(this._dateFilter.tag == 'none' && (newView == ViewState.map
        || (newView == ViewState.month && !sameMonth)
        || (newView == ViewState.week && !sameWeek)
        || (newView == ViewState.threeday && !sameThreeDay))) {
          this.resetDateFilter();
      }
    }
    // if view changed
    let prevView = this._currentView;
    if(newView != prevView) {
      // update view variables
      this.storeLastView(prevView);
      this.setCurrentView(newView);
      // reset certain filters
      this.resetDateFilter();
      if(newView == ViewState.map || prevView == ViewState.map)
        this.resetDateFilter();
    }
  }

  // EVENT RETRIEVAL //

  // Retrieve eventsURL
  private getEventsURL(): string { return `${this.eventsUrl}/`; }

  // Retrieve events by date
  private getEventsByDate(date: Date): string {
    let dt = moment(date);
    const d = dt.format('D'), m = dt.format('MMM'), y = dt.format('YYYY');
    return `${this.eventsUrl}/search?date=${d}%20${m}%20${y}`;
  }

  // Retrieve events by event id
  getEventById(id: string): GeoJson { return this._monthEvents.features.find((e: GeoJson) => e.id == id); }

  // EVENT UPDATES //

  // Update all event containers
  private updateEvents(date: Date, updateMonth: boolean, updateWeek: boolean, updateThreeDay): void {
    if(this.allEvents && this.allEvents.features.length > 0) {
      // update all events
      this.dayEventsSource.next(this.filterByDateSpan(this.allEvents, moment(date).startOf('d'), moment(date).endOf('d')));
      if(updateMonth) this.monthEventsSource.next(this.filterByMonth(this.allEvents, date));
      if(updateWeek) this.weekEventsSource.next(this.filterByWeek(this.allEvents, date));
      if(updateThreeDay) this.threeDayEventsSource.next(this.filterByThreeDays(this.allEvents, date));
      // update category counts
      this.updateCategories();
    }
  }

  // check if two event spans are equal
  equalEventLists(e1: FeatureCollection, e2: FeatureCollection) {
    if(!e1 || !e1.features) { if(!e2 || !e2.features) return true; else return false; }
    if (e1.features.length != e2.features.length) return false;
    return JSON.stringify(e1.features) == JSON.stringify(e2.features);
  }

  // Filter events by a date span
  private filterByDateSpan(allEvents: FeatureCollection, startDate: Moment, endDate: Moment) {
    // filter according to start and end dates
    let filteredEvents = new FeatureCollection([]);
    allEvents.features.forEach(el => {
      let d = moment(el.properties.start_time);
      if (this._dateService.isBetween(d,startDate,endDate))
        filteredEvents.features.push(el);
    });
    // sort filtered events by start time
    filteredEvents.features.sort(function(a, b) {
      let timeA = +new Date(a.properties.start_time);
      let timeB = +new Date(b.properties.start_time);
      if(timeA-timeB == 0){
        let timeAA = +new Date(a.properties.end_time);
        let timeBB = +new Date(b.properties.end_time);
        return timeBB - timeAA;
      } return timeA - timeB;
    });
    return filteredEvents;
  }

  // Filter events by month
  private filterByMonth(allEvents: FeatureCollection, date: Date){
    // determine first day and last day to start displaying events
    let firstDay = moment(date).startOf('month').startOf('week');
    let lastDay = moment(date).endOf('month').endOf('week');
    if(new Date() > firstDay.toDate()) { firstDay = moment(new Date()).startOf('d'); }
    // filter by day span
    return this.filterByDateSpan(allEvents, firstDay, lastDay);
  }

  // Filter events by week
  private filterByWeek(allEvents: FeatureCollection, date: Date){
    // determine first day and last day to start displaying events
    let firstDay = moment(date).startOf('week');
    let lastDay = moment(date).endOf('week');
    if(new Date() > firstDay.toDate()){ firstDay = moment(new Date()).startOf('d'); }
    // filter by day span
    return this.filterByDateSpan(allEvents, firstDay, lastDay);
  }

  // Filter events by three days
  private filterByThreeDays(allEvents: FeatureCollection, date: Date){
    // determine first and last day to start displaying events
    let bounds = this._dateService.getViewBounds(date, ViewState.threeday);
    let firstDay = bounds.startDate, lastDay = bounds.endDate;
    if(new Date() > firstDay.toDate()){ firstDay = moment(new Date()).startOf('d'); }
    // filter by day span
    return this.filterByDateSpan(allEvents, firstDay, lastDay);
  }

  // Helper function to validate images //

  // validate image
  checkImage(imageSrc) {
    if(imageSrc.includes("undefined"))
      return false;
    var img = new Image();
    try {
      img.src = imageSrc;
      return true;
    } catch(err) {
      return false;
    }
  }

  // REST OF THIS FILE HANDLES FILTERS //

  // get categories from the server
  private getCategories(): Observable<any> {
    return this.http.get<any>(this.categoriesUrl);
  }

  // Filter Getters and Setters //

  // reset all filters to defaults
  resetFilters(){
    this.clearCategories();
    this.resetCalendarFilters();
  }

  // reset all calendar filters to defaults
  private resetCalendarFilters(){
    this.resetLocFilter();
    this.resetDateFilter();
    this.resetTimeFilter();
  }

  // update the overall filter count when the given filter.tag is updated to newTag
  private updateFilterCount(newTag, filter) {
    if(newTag == 'none' && filter.tag && filter.tag != 'none') this._filterCount--;
    if(newTag != 'none' && filter.tag && filter.tag == 'none') this._filterCount++;
    this.filterCountSource.next(this._filterCount);
  }

  // methods for updating the location filter
  setLocFilter(locTag: string, displayName: string, locSearch: string){
    let tempFilter = {
      tag: locTag,
      displayName: displayName,
      location: locSearch
    };
    this.updateFilterCount(locTag, this._locFilter);
    this._locFilter = tempFilter;
    this.locFilterSource.next(this._locFilter);
  } getLocFilter() { return this._locFilter; }
  resetLocFilter() { this.setLocFilter('none','none',''); }

  // methods for updating the date filter
  setDateFilter(dateTag: string, displayName: string, dateStart: Date, dateEnd: Date){
    let tempFilter = {
      tag: dateTag,
      displayName: displayName,
      start: dateStart,
      end: dateEnd
    };
    this.updateFilterCount(dateTag, this._dateFilter);
    this._dateFilter = tempFilter;
    this.dateFilterSource.next(this._dateFilter);
    if(this._dateFilter && this._dateFilter.start) {
      let date = this._dateFilter.start;
      if(moment().isAfter(moment(date))) date = new Date();
      this.changeDateSpan(date,this._currentView);
    }
  } getDateFilter() { return this._dateFilter; }
  resetDateFilter() {
    let bounds = this._dateService.getViewBounds(this._selectedDate, this._currentView);
    this.setDateFilter('none','none',bounds.startDate.toDate(),bounds.endDate.toDate());
  }

  // methods for updating the time filter
  setTimeFilter(timeTag: string, displayName: string, timeStart: number, timeEnd: number){
    let tempFilter = {
      tag: timeTag,
      displayName: displayName,
      start: timeStart,
      end: timeEnd
    };
    this.updateFilterCount(timeTag, this._timeFilter);
    this._timeFilter = tempFilter;
    this.timeFilterSource.next(this._timeFilter);
  } getTimeFilter() { return this._timeFilter; }
  resetTimeFilter() { this.setTimeFilter('none','none',0,1439); }

  // Initialize category hash
  private initCategories() {
    // initialize 'all' category
    this._categHash = { 'all': {
      formattedCategory: 'all',
      numEventsDay: 0,
      numEventsThreeDay: 0,
      numEventsWeek: 0,
      numEventsMonth: 0,
      selected: true
    }};
    // initialize other categories
    for (let categ of this.categs.categories) {
      let categName = categ.toLowerCase();
      let categStr = categName.replace('_', ' ');
      categStr = categStr.charAt(0).toUpperCase() + categStr.slice(1).toLowerCase();
      this._categHash[categName] = {
        formattedCategory: categStr,
        numEventsDay: 0,
        numEventsThreeDay: 0,
        numEventsMonth: 0,
        numEventsWeek: 0,
        selected: false
      }
    }
    // update category hash
    this.categHashSource.next(this._categHash);
  }

  // Update category hash
  private updateCategories() {
    // maps store counts of events that fulfill each category
    let dayMap = this.getCategoryMap(this._dayEvents.features, this.categs.categories);
    let threeDayMap = this.getCategoryMap(this._threeDayEvents.features, this.categs.categories);
    let weekMap = this.getCategoryMap(this._weekEvents.features, this.categs.categories);
    let monthMap = this.getCategoryMap(this._monthEvents.features, this.categs.categories);
    // update 'all' categories
    let categAll = this._categHash['all'];
    categAll.numEventsDay = dayMap['all'];
    categAll.numEventsThreeDay = threeDayMap['all'];
    categAll.numEventsWeek = weekMap['all'];
    categAll.numEventsMonth = monthMap['all'];
    // update other categories
    for (let categ of this.categs.categories) {
      let categName = categ.toLowerCase();
      let categCurrent = this._categHash[categName];
      categCurrent.numEventsDay = dayMap[categName];
      categCurrent.numEventsThreeDay = threeDayMap[categName];
      categCurrent.numEventsWeek = weekMap[categName];
      categCurrent.numEventsMonth = monthMap[categName];
    }
    // update category hash
    this.categHashSource.next(this._categHash);
  }

  // Map categories to number of events in input featuresList
  private getCategoryMap(featuresList: GeoJson[], categs: String[]) {
    // initialize map
    let eventMap = {}; let totalEvents = 0;
    for (let categ of categs) { eventMap[categ.toLowerCase()] = 0; }
    // iterate through events
    eventMap['all'] = featuresList.length;
    for (let event of featuresList) {
      if(event.properties.categories){
        for (let categ of event.properties.categories) {
          if (eventMap.hasOwnProperty(categ.toLowerCase())) {
            eventMap[categ.toLowerCase()]++;
    }}}}
    return eventMap;
  }

  // clear any selected category filters
  clearCategories() {
    this._categHash["all"].selected = true
    for (let categ of this.categs.categories) {
      if(this._categHash.hasOwnProperty(categ.toLowerCase())) {
        if(this._categHash[categ.toLowerCase()].selected) this._filterCount--;
        this._categHash[categ.toLowerCase()].selected = false;
      }
    }
    this.filterCountSource.next(this._filterCount);
    this.categHashSource.next(this._categHash);
  }

  // Toggle category
  toggleCategory(categ: string) {
    if (this._categHash[categ] == undefined)
      return
    // apply the category
    this._categHash[categ].selected = !this._categHash[categ].selected;
    if(this._categHash[categ].selected) this._filterCount++;
    else this._filterCount--;
    this._categHash['all'].selected = true;
    for (let categ of this.categs.categories) {
      if(this._categHash.hasOwnProperty(categ.toLowerCase()) && this._categHash[categ.toLowerCase()].selected) {
        this._categHash['all'].selected = false;
        break;
      }
    }
    // update category hash
    this.filterCountSource.next(this._filterCount);
    this.categHashSource.next(this._categHash);
  }

  // Filter Application //

  // Apply filters to day, week, three day, or month
  private applyAllFilters() {
    switch(this._currentView){
      case ViewState.map:
        this.applyFiltersToSelection(this._dayEvents.features, this.filteredDayEventsSource); break;
      case ViewState.threeday:
        this.applyFiltersToSelection(this._threeDayEvents.features, this.filteredThreeDayEventsSource); break;
      case ViewState.week:
        this.applyFiltersToSelection(this._weekEvents.features, this.filteredWeekEventsSource); break;
      case ViewState.month:
        this.applyFiltersToSelection(this._monthEvents.features, this.filteredMonthEventsSource); break;
    }
  }

  // Apply filters to inputFeatures
  private applyFiltersToSelection(inputFeatures: GeoJson[], outputSource: BehaviorSubject <FeatureCollection>){
    // start filtered events collection
    let tempEvents = new FeatureCollection([]);
    // iterate through events
    for (let event of inputFeatures) {
      // both map and calendar view check tags and categories
      let passesCategories = this.passesCategories(event);
      // calendar view checks date, time, location
      let passesLocation = this.passesLocation(event);
      let passesDate = this.passesDate(event);
      let passesTime = this.passesTime(event);
      // ensure event has passed all checks
      if (passesCategories && passesLocation && passesDate && passesTime)
        tempEvents.features.push(event);
    }
    // add a property checking whether event is first on a given day
    let prevDate = null;
    tempEvents.features.forEach(el => {
      let d = moment(el.properties.start_time);
      el.properties.firstOfDay = !(d.isSame(prevDate,'d'));
      prevDate = d;
    });
    // update provided outputSource
    outputSource.next(tempEvents);
  }

  // Filter Check: categories
  private passesCategories(event: GeoJson): boolean {
    let categoryCheck = false;
    if(this._categHash && this._categHash['all'].selected)
      return true;
    if(event.properties.categories){
      for (let categ of event.properties.categories) {
        let categObject = this._categHash[categ.toLowerCase()];
        if (categObject && categObject.selected) {
          categoryCheck = true;
          break;
    }}}
    return categoryCheck;
  }

  // Filter Check: date
  private passesDate(event: GeoJson): boolean {
    if(this._dateFilter.hasOwnProperty('tag') && this._dateFilter['tag'] != 'none') {
      let eventDate = moment(event.properties.start_time);
      return this._dateService.isBetween(eventDate,
        moment(this._dateFilter.start).startOf('day'),
        moment(this._dateFilter.end).endOf('day'));
    }
    return true;
  }

  // Filter Check: time
  private passesTime(event: GeoJson): boolean {
    if(this._timeFilter.hasOwnProperty('tag') && this._timeFilter['tag'] != 'none') {
      let eventStartTime = moment(event.properties.start_time);
      let minStart = eventStartTime.hour()*60 + eventStartTime.minutes();
      switch(this._timeFilter['tag']){
        case 'Happening Now':
          let eventEndTime = moment(event.properties.start_time);
          return this._dateService.isBetween(moment(),eventStartTime,eventEndTime);
          break;
        case 'Upcoming':
          return (minStart > this._dateService.convertTimeToNum(moment()) &&
            minStart <= (this._dateService.convertTimeToNum(moment())+UPCOMING_LEN));
          break;
        case 'Morning':
          return (minStart >= MORNING_START && minStart <= MORNING_END);
          break;
        case 'Afternoon':
          return (minStart >= AFTERNOON_START && minStart <= AFTERNOON_END);
          break;
        case 'Evening':
          return (minStart >= EVENING_START || minStart <= EVENING_END);
          break;
        default:
          return (minStart >= this._timeFilter.start && minStart <= this._timeFilter.end);
          break;
      }
    }
    return true;
  }

  // Filter Check: location
  private passesLocation(event: GeoJson): boolean {
    if(this._locFilter.hasOwnProperty('tag') && this._locFilter['tag'] != 'none') {
      switch(this._locFilter['tag']){
        case 'On Campus':
          return this._locationService.isOnCampus(event.geometry.coordinates[1], event.geometry.coordinates[0]);
          break;
        case 'Off Campus':
          return !this._locationService.isOnCampus(event.geometry.coordinates[1], event.geometry.coordinates[0]);
          break;
        case 'Custom':
          if(this._locFilter.location != ""){
            let eventLocation = event.properties.place.name;
            if(eventLocation){
              let inputVal = new RegExp(this._locFilter.location.trim(), 'i');
              if(inputVal.test(eventLocation)) return true;
          }}
          return false;
          break;
      }
    }
    return true;
  }

}
