import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { Observable } from 'rxjs/Observable';
import { catchError, map, tap } from 'rxjs/operators';

import { CategoryList } from './category';

const httpOptions = {
  headers: new HttpHeaders({ 'Content-Type': 'application/json' })
};

@Injectable()
export class CategoryService {
  private apiUrl = "http://www.whatsmappening.io/api/v1/event-categories";

  constructor(
    private http: HttpClient
  ) { }

  /** GET categories from the server */
  getCategories(): Observable<CategoryList> {
    return this.http.get<CategoryList>(this.apiUrl);
  }
}