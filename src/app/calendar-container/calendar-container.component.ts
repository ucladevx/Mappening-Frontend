import { Component, OnInit } from '@angular/core';
import { Router, RouterLinkActive, ActivatedRoute } from '@angular/router';
import { ContentChild } from '@angular/core';
import { MonthComponent } from '../month/month.component';
import { WeekComponent } from '../week/week.component';
import { ThreeDayComponent } from '../three-day/three-day.component';
import { EventService } from '../services/event.service';
import * as moment from 'moment';
import { Moment } from 'moment';
import { ViewState } from '../view-enum';

@Component({
  selector: 'app-calendar-container',
  templateUrl: './calendar-container.component.html',
  styleUrls: ['./calendar-container.component.scss'],
  providers: [WeekComponent, MonthComponent, ThreeDayComponent]
})

export class CalendarContainerComponent implements OnInit {
  public ViewState = ViewState;

  public viewDate: string;
  currentPath = '';

  @ContentChild(MonthComponent, /* TODO: add static flag */ {})
  private monthComponent: MonthComponent;

  @ContentChild(WeekComponent, /* TODO: add static flag */ {})
  private weekComponent: WeekComponent;

  @ContentChild(ThreeDayComponent, /* TODO: add static flag */ {})
  private threeDayComponent: ThreeDayComponent;

  // week number
  weekNumber: string;

  // retrieved from UCLA online academic calendar
  zeroWeeks: Moment[] = [
    moment([2019,8,22]), moment([2020,0,5]), moment([2020,2,29]),   //2019-2020
    moment([2020,8,27]), moment([2021,0,4]), moment([2021,2,29]),   //2020-2021
    moment([2021,8,19]), moment([2022,0,2]), moment([2022,2,28]),   //2021-2022
    moment([2022,8,19]), moment([2023,0,9]), moment([2023,3,2])     //2022-2023
  ];

  constructor(public router: Router, private _eventService: EventService, route: ActivatedRoute) {
    this.currentPath = route.snapshot.url.join('');
  }

  ngOnInit() {
    this._eventService.selectedDate$.subscribe( date => { this.viewDateChange(date); });
    this.enumerateWeek(this._eventService.getCurrentView());
  }

  viewDateChange(set : Date) {
    this.viewDate = set.toLocaleDateString("en-US", {month: 'long', year: 'numeric'});
  }

  getCalendarView() : ViewState {
    return this._eventService.getCurrentView();
  }

  changeDateSpan(delta: number, calendarView: ViewState) : void{
    // determine date to display in new view
    let newDate = this._eventService.getSelectedDate();
    switch(calendarView) {
        case ViewState.month :
          newDate = moment(newDate).startOf('month').add(delta,'M'); break;
        case ViewState.week :
          newDate = moment(newDate).startOf('week').add(delta*7,'d'); break;
        case ViewState.threeday :
          newDate = moment(newDate).add(delta*3,'d'); break;
    }
    this._eventService.changeDateSpan(newDate, calendarView);
    this.enumerateWeek(calendarView);
  }

  //set the week number
  enumerateWeek(view: ViewState){
    //count weeks
    let weekCount;
    let secondWeekCount;
    let currentDate = moment(this._eventService.getSelectedDate());
    let firstDate = currentDate;
    let lastDate;
    if (view == ViewState.threeday) {
      let numDaysDiff = currentDate.startOf('day').diff(moment().startOf('day'), 'days');
      let dayOfGroup;
      if (numDaysDiff >= 0) {
        dayOfGroup = (numDaysDiff % 3 == 0) ? 0 : ((numDaysDiff % 3 == 1) ? 1 : 2);
      }
      else {
        numDaysDiff *= -1;
        dayOfGroup = (numDaysDiff % 3 == 0) ? 0 : ((numDaysDiff % 3 == 1) ? 2 : 1);
      }
      firstDate = currentDate.clone().add(-1*dayOfGroup, 'days');
    }
    lastDate = firstDate.clone().add(2, 'days');
    for(let i = this.zeroWeeks.length-1; i>=0; i--){
      weekCount = Math.floor(firstDate.diff(this.zeroWeeks[i],'days') / 7);
      secondWeekCount = Math.floor(lastDate.diff(this.zeroWeeks[i],'days') / 7);
      if(weekCount>=0){ if(i%3 != 0){ weekCount++; } i = -1; }
      if(secondWeekCount>=0){ if(i%3 != 0){ secondWeekCount++; } i = -1; }
    }
    if(weekCount == 11)
      this.weekNumber = "Finals week";
    else if(weekCount > 11 || weekCount < 0 || weekCount == undefined) {
      this.weekNumber = "";
      if (view == ViewState.threeday) {
        if(!(secondWeekCount > 11 || secondWeekCount < 0 || secondWeekCount == undefined)) {
          this.weekNumber = "Week " + secondWeekCount;
        }
      }
    }
    else {
      this.weekNumber = "Week " + weekCount;
      if (view == ViewState.threeday)
        if(!(secondWeekCount > 11 || secondWeekCount < 0 || secondWeekCount == undefined))
          if (secondWeekCount != weekCount)
            this.weekNumber = this.weekNumber + "-" + secondWeekCount;
    }
  }

}
