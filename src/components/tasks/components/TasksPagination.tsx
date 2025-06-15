
import React from 'react';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

interface TasksPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const TasksPagination = ({ currentPage, totalPages, onPageChange }: TasksPaginationProps) => {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-6 flex justify-center">
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious 
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
          
          {[...Array(totalPages)].map((_, index) => {
            const page = index + 1;
            const isCurrentPage = page === currentPage;
            const showPage = 
              page === 1 || 
              page === totalPages || 
              (page >= currentPage - 2 && page <= currentPage + 2);
            
            if (!showPage) {
              if (page === currentPage - 3 || page === currentPage + 3) {
                return (
                  <PaginationItem key={page}>
                    <span className="px-3 py-2">...</span>
                  </PaginationItem>
                );
              }
              return null;
            }
            
            return (
              <PaginationItem key={page}>
                <PaginationLink
                  onClick={() => onPageChange(page)}
                  isActive={isCurrentPage}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            );
          })}
          
          <PaginationItem>
            <PaginationNext 
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
};
