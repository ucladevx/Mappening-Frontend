import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { FeatureCollection, GeoJson } from '../map';
import { EventService } from '../event.service';
import { DateService } from '../shared/date.service';

@Component({
    selector: 'app-event-detail',
    templateUrl: './event-detail.component.html',
    styleUrls: ['./event-detail.component.css']
})
export class EventDetailComponent implements OnInit {
  @Input() event: any;
  @Output() showSideBarBool = new EventEmitter<boolean>();

  constructor(
      private route: ActivatedRoute,
      private eventService: EventService,
      private dateService: DateService
  ) {}

  ngOnInit() {
      this.route.params.subscribe(() => {
          const id: string = this.route.snapshot.paramMap.get('id');
          this.event = this.eventService.getEventById(id);
      });
  }

  hideEvent($event) {
    //update expanded event
    this.eventService.updateExpandedEvent(null);
    //unbold the popup event title
    this.eventService.boldPopup(null);
    //weekview
    this.showSideBarBool.emit(true);
    this.eventService.updateClickedEvent(null);
  }

}
